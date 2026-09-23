/* Orchestrator: decisions/config are persistent; all derived tables are recomputed. */
function v3OnOpen() {
  SpreadsheetApp.getUi().createMenu('VR Experiment V3').addItem('Initial Setup', 'v3InitialSetup').addItem(
      'Run Full Analysis', 'v3RunFullAnalysis').addItem('Review Unresolved Words', 'v3ReviewUnresolvedWords')
    .addItem('Apply Word Decisions and Recalculate', 'v3ApplyWordDecisionsAndRecalculate').addItem(
      'Compare Two Variables', 'v3CompareTwoVariables').addItem(
      'Run Validation Tests', 'v3RunValidationTests').addToUi();
}

function v3Locked_(work) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another V3 analysis is running');
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

function v3InitialSetup() {
  return v3Locked_(function() {
    v3SeedMigration_();
    v3ApplySheetVisibility_();
    v3InstallMenu();
    v3OnOpen();
    SpreadsheetApp.getActive().toast(
      'V3 setup complete. Variable comparisons now refresh automatically. Run Full Analysis only after source data changes.',
      'VR Experiment V3', 8);
  });
}

function v3Compute_(files, qSources, state, issues) {
  const catalog = v3BuildCatalog_(files, state.cfg, issues);
  const quest = v3BuildQuest_(files, state, issues);
  const trials = v3BuildRecall_(files, state, catalog, issues);
  const questionnaires = v3BuildQuestionnaires_(qSources, state, issues);
  const questions = questionnaires.records;
  const prior = v3Group_(questions.filter(function(r) {
    return r.prior_vr_experience !== '';
  }), function(r) {
    return r.participant_id;
  });
  Object.keys(prior).forEach(function(id) {
    const values = v3Unique_(prior[id].map(function(r) {
      return r.prior_vr_experience;
    }));
    const registry = state.registry.find(function(r) {
      return r.canonical_participant_id === id;
    });
    const explicit = registry ? v3Boolean_(registry.prior_vr_experience) : '';
    const value = explicit !== '' ? explicit : values.length === 1 ? values[0] : '';
    if (values.length > 1) v3Issue_(issues, 'Warning', 'prior_vr_inconsistent', 'Questionnaires', id,
      'Contradictory prior-VR answers; no subgroup guess.',
      'Record the verified value in Participant Registry.');
    trials.concat(quest).filter(function(r) {
      return r.participant_id === id;
    }).forEach(function(r) {
      r.prior_vr_experience = value;
    });
  });
  const pairedMetadata = v3Group_(trials.filter(function(t) {
    return t.status === 'Include';
  }), function(t) {
    return t.participant_id + '|' + t.timepoint;
  });
  Object.keys(pairedMetadata).forEach(function(k) {
    const a = pairedMetadata[k];
    if (v3Unique_(a.map(function(t) {
        return t.word_list_set;
      })).length > 1) v3Issue_(issues, 'Warning', 'mixed_list_sets', k, a[0].participant_id,
      'Conditions use different list sets; the palace comparison is confounded.',
      'Review File Decisions and report list-set sensitivity.');
  });
  const stats = v3BuildStatistics_(trials, questions, quest, state),
    sessionOrder = v3BuildSessionOrderStatistics_(trials, state),
    items = v3ItemRows_(trials, quest, questions, state.cfg);
  const findings = v3Interesting_(stats, trials, questions, quest, items, state, issues);
  return {
    trials: trials,
    questions: questions,
    quest: quest,
    stats: stats,
    sessionOrder: sessionOrder,
    items: items,
    findings: findings,
    issues: issues,
    questionMapping: questionnaires.mapping
  };
}

// ponytail: checkpoint in a hidden sheet; no new Drive write permissions or external service.
function v3SaveRun_(job) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('_V3 Analysis Checkpoint') || ss.insertSheet('_V3 Analysis Checkpoint');
  const json = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(job))).getBytes());
  const rows = [];
  for (let i = 0; i < json.length; i += 40000) rows.push([json.slice(i, i + 40000)]);
  v3Size_(sheet, rows.length + 1, 1);
  sheet.getRange(1, 1, rows.length + 1, 1).setValues([[rows.length]].concat(rows));
  sheet.hideSheet();
  SpreadsheetApp.flush();
}

function v3FinishRun_() {
  ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === 'v3ContinueAnalysis';
  }).forEach(function(t) { ScriptApp.deleteTrigger(t); });
  PropertiesService.getScriptProperties().deleteProperty('v3AnalysisRun');
  const sheet = SpreadsheetApp.getActive().getSheetByName('_V3 Analysis Checkpoint');
  if (sheet) SpreadsheetApp.getActive().deleteSheet(sheet);
}

function v3Execute_() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('v3AnalysisRun')) {
    SpreadsheetApp.getActive().toast('Analysis is already running. See V3 Start Here.', 'VR Experiment V3', 8);
    return 'Analysis is already running; see V3 Start Here.';
  }
  v3WriteGenerated_('Start Here', [{ topic: 'Run status', value: 'Running — results not yet approved',
    detail: 'Processing in batches. Continuations run automatically; wait for Complete.' }]);
  v3SaveRun_({ stage: 'setup', done: {}, issues: [] });
  try {
    const trigger = ScriptApp.newTrigger('v3ContinueAnalysis').timeBased().everyMinutes(1).create();
    properties.setProperty('v3AnalysisRun', JSON.stringify({ spreadsheetId: SpreadsheetApp.getActive().getId(),
      triggerId: trigger.getUniqueId(), attempts: 0 }));
  } catch (e) {
    v3FinishRun_();
    throw e;
  }
  SpreadsheetApp.getActive().toast('Analysis started. Progress is shown in V3 Start Here.', 'VR Experiment V3', 8);
  return 'Analysis started; it will continue automatically.';
}

function v3RunStep_(job, name, work, check) {
  if (job.done[name]) return;
  check();
  work();
  job.done[name] = true;
}

function v3ContinueAnalysis(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const properties = PropertiesService.getScriptProperties();
  let meta;
  try {
    const raw = properties.getProperty('v3AnalysisRun');
    if (!raw) return;
    meta = JSON.parse(raw);
    SpreadsheetApp.setActiveSpreadsheet(SpreadsheetApp.openById(meta.spreadsheetId));
    meta.attempts++;
    properties.setProperty('v3AnalysisRun', JSON.stringify(meta));
    if (meta.attempts > 3) throw new Error('A single analysis step repeatedly exceeded the runtime limit. Review the execution log and rerun.');
    const sheet = SpreadsheetApp.getActive().getSheetByName('_V3 Analysis Checkpoint');
    const count = sheet.getRange(1, 1).getValue();
    const encoded = sheet.getRange(2, 1, count, 1).getValues().map(function(r) { return r[0]; }).join('');
    const checkpoint = Utilities.newBlob(Utilities.base64Decode(encoded), 'application/x-gzip',
      'v3-analysis-checkpoint.gz');
    const job = JSON.parse(Utilities.ungzip(checkpoint).getDataAsString());
    const deadline = Date.now() + 180000;
    const pause = {};
    const check = function() { if (Date.now() >= deadline) throw pause; };
    const step = function(name, work) { return v3RunStep_(job, name, work, check); };
    try {
      if (job.stage === 'setup') {
        v3SeedMigration_();
        job.state = v3State_();
        job.previous = v3ReadTable_('Import Audit');
        job.scan = {};
        job.stage = 'import';
        throw pause;
      }
      if (job.stage === 'import') {
        job.scan = v3ScanSources_(job.state.cfg, job.previous, job.issues, job.scan, check);
        job.stage = 'compute';
        throw pause;
      }
      if (job.stage === 'compute') {
        const files = v3ParseFiles_(job.scan.files, job.issues);
        const sources = v3ReadQuestionSources_(job.state.cfg);
        const additions = v3Discover_(v3Observations_(files, sources), job.state.registry);
        // Read live IDs on retry so a stopped run cannot append a participant twice.
        const known = new Set(v3ReadTable_('Participant Registry').map(function(r) { return r.canonical_participant_id; }));
        v3Append_('Participant Registry', additions.filter(function(r) { return !known.has(r.canonical_participant_id); }));
        job.state.registry = job.state.registry.concat(additions);
        job.result = v3Compute_(files, sources, job.state, job.issues);
        job.result.importAudit = job.scan.audit;
        sources.forEach(function(s) {
          const before = job.previous.find(function(r) { return r.file_id === s.id; });
          job.result.importAudit.push({ file_id: s.id, file_name: s.name, kind: 'questionnaire',
            content_hash: s.hash, change: !before ? 'New' : before.content_hash === s.hash ? 'Unchanged' : 'Changed', status: 'Read' });
        });
        delete job.scan;
        delete job.previous;
        job.stage = 'outputs';
        throw pause;
      }
      step('queue', function() { job.queue = v3UpsertQueue_(v3QueueRows_(job.result.trials)); });
      v3WriteOutputs_(job.result, job.state, job.queue, step);
      v3FinishRun_();
      SpreadsheetApp.getActive().toast('Analysis complete. Open V3 Start Here.', 'VR Experiment V3', 10);
      return;
    } catch (err) {
      if (err !== pause) throw err;
      v3SaveRun_(job);
      meta.attempts = 0;
      properties.setProperty('v3AnalysisRun', JSON.stringify(meta));
      v3WriteGenerated_('Start Here', [{ topic: 'Run status', value: 'Running — results not yet approved',
        detail: 'Next stage: ' + job.stage + '. Completed output steps: ' + Object.keys(job.done).length +
          '. Continues automatically; do not change source data or decisions until Complete.' }]);
    }
  } catch (err) {
    if (meta) {
      v3WriteGenerated_('Start Here', [{ topic: 'Run status', value: 'FAILED — do not interpret generated results',
        detail: err.message, open_next: 'Fix the error and rerun Full Analysis' }]);
      v3FinishRun_();
    }
    throw err;
  } finally { lock.releaseLock(); }
}

function v3RunFullAnalysis() {
  const result = v3Locked_(v3Execute_);
  if (result === 'Analysis started; it will continue automatically.') v3ContinueAnalysis();
  return result;
}

function v3ReviewUnresolvedWords() {
  const s = v3Sheet_('Word Review Queue');
  s.showSheet();
  SpreadsheetApp.getActive().setActiveSheet(s);
  if (s.getFilter()) s.getFilter().remove();
  if (s.getLastRow() > 1) {
    const h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const f = s.getDataRange().createFilter();
    f.setColumnFilterCriteria(h.indexOf('current_scoring_result') + 1, SpreadsheetApp.newFilterCriteria()
      .whenTextEqualTo('Not counted').build());
    f.setColumnFilterCriteria(h.indexOf('researcher_decision') + 1, SpreadsheetApp.newFilterCriteria()
      .whenTextEqualTo('Unreviewed').build());
    f.setColumnFilterCriteria(h.indexOf('review_status') + 1, SpreadsheetApp.newFilterCriteria()
      .whenTextEqualTo('Current').build());
  }
}

function v3ApplyWordDecisionsAndRecalculate() {
  return v3Locked_(function() {
    if (PropertiesService.getScriptProperties().getProperty('v3AnalysisRun'))
      throw new Error('Wait for the current analysis to finish before applying decisions.');
    const queue = v3ReadTable_('Word Review Queue'),
      rules = v3ReadTable_('Word Decisions'),
      compiled = v3CompileDecisions_(queue, rules, new Date().toISOString());
    v3Append_('Word Decisions', compiled.additions);
    v3UpdateDecisionReceipts_(compiled.updates);
    return v3Execute_();
  });
}

function v3RunValidationTests() {
  return v3Locked_(function() {
    const rows = v3ValidationResults_();
    v3WriteGenerated_('Test Results', rows, ['test', 'status', 'details']);
    const failed = rows.filter(function(r) {
      return r.status === 'FAIL';
    });
    if (failed.length) throw new Error(failed.length + ' V3 validation tests failed');
    const message = rows.length + ' V3 validation tests passed';
    SpreadsheetApp.getActive().toast(message, 'VR Experiment V3', 8);
    return message;
  });
}

function v3ResetAuthorization() {
  ScriptApp.invalidateAuth();
}
