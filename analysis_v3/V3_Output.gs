/* Batched spreadsheet IO. Rebuilds are restricted to an explicit generated-sheet allowlist. */
function v3Sheet_(name) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName('V3 ' + name) || ss.insertSheet('V3 ' + name);
}

function v3ReaderSheetNames_() {
  return ['Start Here', 'Data Quality', 'Missing Data', 'Key Results', 'Interesting Findings',
    'Participant Summary', 'Session Order', 'Charts'
  ];
}

function v3ApplySheetVisibility_() {
  const ss = SpreadsheetApp.getActive(),
    visible = new Set(v3ReaderSheetNames_()),
    start = v3Sheet_('Start Here');
  start.showSheet();
  ss.setActiveSheet(start);
  ss.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    if (!name.startsWith('V3 ')) return;
    if (visible.has(name.slice(3))) sheet.showSheet();
    else sheet.hideSheet();
  });
}

function v3Size_(sheet, rows, cols) {
  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < cols) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols - sheet
    .getMaxColumns());
}

function v3SafeCell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (typeof v === 'object') v = JSON.stringify(v);
  if (typeof v === 'string' && v.length > 49000) throw new Error(
    'Output cell exceeds safe Sheets limit; inspect source ' + v.slice(0, 80));
  return typeof v === 'string' && v.startsWith('=') ? "'" + v : v;
}

function v3ReadTable_(name, ss, prefix) {
  const sheet = (ss || SpreadsheetApp.getActive()).getSheetByName((prefix === undefined ? 'V3 ' : prefix) +
    name);
  if (!sheet || sheet.getLastRow() < 1) return [];
  const a = sheet.getDataRange().getValues(),
    h = a.shift().map(v3Text_);
  if (v3Unique_(h).length !== h.length) throw new Error('Duplicate table headers: ' + name);
  return a.filter(function(row) {
    return row.some(function(v) {
      return v3Text_(v);
    });
  }).map(function(row) {
    const r = {};
    h.forEach(function(k, i) {
      r[k] = row[i] === undefined ? '' : row[i];
    });
    return r;
  });
}

function v3EnsurePersistent_(name) {
  const headers = v3PersistentHeaders_()[name];
  if (!headers) throw new Error('Unknown persistent table');
  const s = v3Sheet_(name);
  if (!s.getLastRow()) {
    v3Size_(s, 1, headers.length);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const old = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const missing = headers.filter(function(h) {
      return !old.includes(h);
    });
    if (missing.length) {
      v3Size_(s, 1, old.length + missing.length);
      s.getRange(1, old.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  s.setFrozenRows(1);
  return s;
}

function v3Append_(name, rows) {
  if (!rows.length) return;
  const s = v3EnsurePersistent_(name),
    h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  v3Size_(s, s.getLastRow() + rows.length, h.length);
  s.getRange(s.getLastRow() + 1, 1, rows.length, h.length).setValues(rows.map(function(r) {
    return h.map(function(k) {
      return v3SafeCell_(r[k]);
    });
  }));
}

function v3UpsertQueue_(newRows) {
  const s = v3EnsurePersistent_('Word Review Queue'),
    old = v3ReadTable_('Word Review Queue');
  const merged = v3MergeQueue_(old, newRows);
  const h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  // Write only machine-owned columns in existing rows; never touch decision/notes columns here.
  const editable = ['researcher_decision', 'replacement_target', 'scope', 'notes', 'decision_timestamp',
    'applied_signature'
  ];
  if (old.length) h.forEach(function(k, i) {
    if (editable.includes(k)) return;
    s.getRange(2, i + 1, old.length, 1).setValues(merged.slice(0, old.length).map(function(r) {
      return [v3SafeCell_(r[k])];
    }));
  });
  v3Append_('Word Review Queue', merged.slice(old.length));
  v3QueueValidation_(s);
  return merged;
}

function v3QueueValidation_(s) {
  const h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  const n = Math.max(1, s.getLastRow() - 1);
  [
    ['researcher_decision', v3DecisionChoices_()],
    ['scope', v3Scopes_()]
  ].forEach(function(d) {
    const col = h.indexOf(d[0]) + 1;
    if (col) s.getRange(2, col, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(d[1], true).setAllowInvalid(false).build());
  });
  s.setFrozenColumns(2);
  s.getRange(1, 1, 1, h.length).setBackground('#183B4E').setFontColor('#FFFFFF').setFontWeight('bold');
  s.setColumnWidths(10, 11, 170);
}

function v3UpdateDecisionReceipts_(updates) {
  const s = v3Sheet_('Word Review Queue'),
    h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  const old = v3ReadTable_('Word Review Queue');
  const map = new Map(updates.map(function(r) {
    return [r.review_id, r];
  }));
  ['decision_timestamp', 'applied_signature'].forEach(function(k) {
    if (!old.length) return;
    s.getRange(2, h.indexOf(k) + 1, old.length, 1).setValues(old.map(function(r) {
      return [v3SafeCell_((map.get(r.review_id) || r)[k])];
    }));
  });
}

function v3WriteGenerated_(name, rows, headers) {
  if (!v3GeneratedNames_().includes(name)) throw new Error('Refusing to clear persistent or unknown sheet: ' +
    name);
  const s = v3Sheet_(name);
  if (s.getFilter()) s.getFilter().remove();
  s.clearContents();
  const h = headers || v3Unique_([].concat.apply([], rows.map(function(r) {
    return Object.keys(r);
  }))).filter(function(k) {
    return k !== 'pairs';
  });
  const keys = h.length ? h : ['status'];
  v3Size_(s, Math.max(2, rows.length + 1), keys.length);
  s.getRange(1, 1, 1, keys.length).setValues([keys]);
  if (rows.length) s.getRange(2, 1, rows.length, keys.length).setValues(rows.map(function(r) {
    return keys.map(function(k) {
      return v3SafeCell_(r[k]);
    });
  }));
  s.setFrozenRows(1);
  s.setHiddenGridlines(true);
  s.getRange(1, 1, 1, keys.length).setBackground('#183B4E').setFontColor('#FFFFFF').setFontWeight('bold');
  s.setColumnWidths(1, keys.length, 140);
  return s;
}

function v3ReadSettings_() {
  const cfg = v3Defaults_();
  const rows = v3ReadTable_('Settings');
  const grouped = v3Group_(rows, function(r) {
    return r.key;
  });
  Object.keys(grouped).forEach(function(k) {
    if (grouped[k].length > 1) throw new Error('Duplicate setting ' + k);
    if (!Object.prototype.hasOwnProperty.call(cfg, k)) return;
    const v = grouped[k][0].value;
    try {
      cfg[k] = typeof cfg[k] === 'object' ? JSON.parse(v) : typeof cfg[k] === 'boolean' ? v3Boolean_(v) :
        typeof cfg[k] === 'number' ? v3Number_(v) : v3Text_(v);
    } catch (e) {
      throw new Error('Invalid JSON setting ' + k);
    }
  });
  ['min_subgroup_n', 'min_association_n', 'tiny_sample_n'].forEach(function(k) {
    if (!Number.isInteger(cfg[k]) || cfg[k] < 2) throw new Error(k + ' must be an integer >=2');
  });
  if (!Array.isArray(cfg.timepoints) || v3Unique_(cfg.timepoints.map(function(t) {
      return t.id;
    })).length !== cfg.timepoints.length) throw new Error('Invalid timepoint configuration');
  const authority = v3Defaults_().condition_map;
  if (JSON.stringify(cfg.condition_map) !== JSON.stringify(authority)) throw new Error(
    'Authoritative condition mapping cannot be changed');
  return cfg;
}

function v3State_() {
  return {
    cfg: v3ReadSettings_(),
    registry: v3ReadTable_('Participant Registry'),
    conditionOverrides: v3ReadTable_('Participant Condition Overrides'),
    sessionOverrides: v3ReadTable_('Session Overrides'),
    fileDecisions: v3ReadTable_('File Decisions'),
    wordDecisions: v3ReadTable_('Word Decisions')
  };
}

function v3SeedMigration_() {
  Object.keys(v3PersistentHeaders_()).forEach(v3EnsurePersistent_);
  const cfg = v3Defaults_(),
    existing = v3ReadTable_('Settings'),
    keys = new Set(existing.map(function(r) {
      return r.key;
    }));
  let source = SpreadsheetApp.getActive();
  const selected = existing.find(function(r) {
    return r.key === 'migration_source_spreadsheet_id';
  });
  if (selected && selected.value) source = SpreadsheetApp.openById(selected.value);
  const v2Settings = v3ReadTable_('Configuration and Overrides', source, 'V2 ');
  const overrides = {};
  v2Settings.forEach(function(r) {
    overrides[r.key] = r.value;
  });
  const map = {
    word_list_files: 'word_list_file_ids'
  };
  v3Append_('Settings', Object.keys(cfg).filter(function(k) {
    return !keys.has(k);
  }).map(function(k) {
    let value = Object.prototype.hasOwnProperty.call(overrides, map[k] || k) ? overrides[map[k] || k] :
      cfg[k];
    if (k === 'word_list_files' && typeof value === 'string') {
      try {
        const ids = JSON.parse(value);
        value = ids.map(function(x) {
          return Object.assign({}, cfg.word_list_files.find(function(d) {
            return d.id === x.id || d.name === x.name;
          }) || {}, x);
        });
        cfg.word_list_files.forEach(function(d) {
          if (!value.some(function(x) {
              return x.id === d.id;
            })) value.push(d);
        });
      } catch (e) {
        throw new Error('Cannot migrate V2 word_list_file_ids');
      }
    }
    return {
      key: k,
      value: typeof value === 'object' ? JSON.stringify(value) : value,
      notes: overrides[map[k] || k] !== undefined ? 'Migrated from V2' : 'V3 default; edit value here'
    };
  }));
  const migrations = [
    ['Participant Registry', 'Participant Registry', 'canonical_participant_id', v3RegistryDefaults_()],
    ['Participant Condition Overrides', 'Participant Condition Overrides', null, v3ConditionDefaults_()],
    ['Session Overrides', 'Session Overrides', 'session_id', []],
    ['File Decisions', 'File Include Overrides', 'file_id', []]
  ];
  migrations.forEach(function(d) {
    const marker = 'migration_done_' + d[0];
    if (existing.some(function(r) {
        return r.key === marker && v3Boolean_(r.value) === true;
      })) return;
    const old = v3ReadTable_(d[0]),
      src = v3ReadTable_(d[1], source, 'V2 ');
    const key = function(r) {
      return d[2] ? v3NormalizeText_(r[d[2]]) : v3NormalizeText_(r.participant_id) + '|' + v3Key_(r
        .source_condition_raw);
    };
    const seen = new Set(old.map(key));
    const additions = [];
    src.concat(d[3]).forEach(function(r) {
      if (seen.has(key(r))) return;
      seen.add(key(r));
      const copy = Object.assign({}, r);
      if (d[0] === 'Participant Registry') copy.review_status = copy.review_status || 'Reviewed';
      additions.push(copy);
    });
    v3Append_(d[0], additions);
    v3Append_('Settings', [{
      key: marker,
      value: true,
      notes: 'One-time migration completed; researcher edits preserved'
    }]);
  });
  if (!existing.some(function(r) {
      return r.key === 'migration_done_words' && v3Boolean_(r.value) === true;
    })) {
    const old = v3ReadTable_('Word Match Overrides', source, 'V2 ');
    v3Append_('Word Decisions', old.map(function(r, i) {
      const pending = /near miss|fuzzy/i.test(v3Text_(r.method)) || v3Boolean_(r.manual_review_flag) ===
        true;
      return {
        rule_id: v3Id_(['v2-migration', i, JSON.stringify(r)]),
        review_id: '',
        normalized_response: v3NormalizeText_(r.normalized_response || r.raw_response),
        target_word: v3NormalizeText_(r.replacement_target_word),
        decision: r.replacement_target_word ? 'correct' : 'incorrect',
        scope: 'Global spelling/alias rule',
        active: !pending,
        origin: 'V2 Word Match Overrides',
        notes: JSON.stringify(r) + (pending ? ' | Preserved inactive: requires explicit review.' : ''),
        decision_timestamp: 'Migrated'
      };
    }));
    v3Append_('Settings', [{
      key: 'migration_done_words',
      value: true,
      notes: 'V2 rules preserved; suggestions inactive, explicit decisions active.'
    }]);
  }
  // ponytail: append only missing verified rows, so reruns preserve researcher edits.
  const registry = v3ReadTable_('Participant Registry');
  v3Append_('Participant Registry', v3RegistryDefaults_().filter(function(r) {
    return !registry.some(function(old) {
      return v3NormalizeText_(old.canonical_participant_id) === v3NormalizeText_(r.canonical_participant_id);
    });
  }));
  const sessions = v3ReadTable_('Session Overrides');
  v3Append_('Session Overrides', v3DefaultQuestSessionOverrides_().filter(function(r) {
    return !sessions.some(function(old) {
      return old.session_id === r.session_id;
    });
  }));
}

function v3Missing_(trials, questions, state) {
  const out = [];
  v3ExpectedParticipants_(state).forEach(function(id) {
    ['Generic', 'Personalized'].forEach(function(c) {
      state.cfg.timepoints.filter(function(t) {
        return t.required || trials.some(function(r) {
          return r.timepoint === t.id;
        });
      }).forEach(function(tp) {
        const observed = trials.filter(function(t) {
          return t.participant_id === id && t.palace_condition === c && t.timepoint === tp.id;
        });
        out.push({
          participant_id: id,
          condition: c,
          outcome: tp.id,
          status: observed.some(function(r) {
            return r.status === 'Include';
          }) ? 'Present' : observed.length ? v3Unique_(observed.map(function(r) {
            return r.status;
          })).join(';') : 'Missing',
          observed: observed.length,
          action: 'Review Recall Trials / File Decisions for this cell.'
        });
      });
      v3QuestionMetrics_().filter(function(d) {
        return !/^Legacy|exploratory/i.test(d.name) && !d.role;
      }).forEach(function(d) {
        const rs = questions.filter(function(r) {
          return r.participant_id === id && r.palace_condition === c && r.metric === d.name;
        });
        out.push({
          participant_id: id,
          condition: c,
          outcome: d.name,
          status: rs.some(function(r) {
            return r.status === 'Include';
          }) ? 'Present' : rs.length ? 'Invalid / incomplete' : 'Missing',
          observed: rs.length,
          action: 'Review Questionnaire Scores.'
        });
      });
    });
  });
  return out;
}

function v3WordResults_(items) {
  const groups = v3Group_(items.filter(function(r) {
    return r.status === 'Include';
  }), function(r) {
    return JSON.stringify([r.timepoint, r.palace_condition, r.list_id, r.word_list_set, r.target_word, r
      .serial_position
    ]);
  });
  return Object.keys(groups).sort().map(function(k) {
    const a = groups[k],
      r = a[0];
    return {
      timepoint: r.timepoint,
      palace_condition: r.palace_condition,
      list_id: r.list_id,
      word_list_set: r.word_list_set,
      target_word: r.target_word,
      serial_position: r.serial_position,
      pRecall: r.pRecall,
      precall_band: r.precall_band,
      participant_n: v3Unique_(a.map(function(x) {
        return x.participant_id;
      })).length,
      recall_rate: v3Mean_(a.map(function(x) {
        return x.recalled_binary;
      }))
    };
  });
}

function v3Dictionary_(state, mapping) {
  const rows = [{
    topic: 'Primary outcome',
    formula: 'Immediate correct unique / ordered target-list length; paired Personalized minus Generic',
    missing_rule: 'Only complete eligible pairs; no zero imputation'
  }, {
    topic: 'Primary follow-up',
    formula: 'Delayed24h correct unique / ordered target-list length; same pairing',
    missing_rule: 'One-week is separate secondary outcome'
  }, {
    topic: 'Recall/order',
    formula: 'First occurrence per target. Exact position uses original response slot including blank slots. LCS uses first matched target sequence. Kendall tau-a compares all pairs in that sequence. Adjacent pairs require consecutive ascending target positions.',
    missing_rule: 'Unavailable order correlation/displacement remains blank'
  }, {
    topic: 'Response counts',
    formula: 'Responses entered includes ignored nonempty entries; repetitions count extra target/normalized-intrusion occurrences. Near misses are unapproved suggestions. Intrusions are unmatched responses without suggestions. Omissions = target length - unique correct.',
    missing_rule: 'Absent trials never score zero; a submitted all-blank wide trial can score zero'
  }, {
    topic: 'Manual decisions',
    formula: 'Occurrence > participant+list+set+ordered-target-signature > global rule. Conflicting equal-precedence rules block trial. Superseded rules remain in history.',
    missing_rule: 'A source change yielding a new review ID cannot inherit an occurrence rule'
  }, {
    topic: 'Duration',
    formula: 'Explicit nonnegative seconds, or milliseconds / 1000, only when Timed=true',
    missing_rule: 'No timestamp subtraction; false/unknown timed stays blank'
  }, {
    topic: 'Retention',
    formula: 'Later accuracy minus Immediate accuracy within participant, condition, list set and exact ordered targets',
    missing_rule: 'Requires both included records'
  }, {
    topic: 'Paired statistics',
    formula: 'Mean/SD from same complete pairs; t=mean(d)/(SD(d)/sqrt(N)); dz=mean(d)/SD(d); CI=t-critical(N-1)*SE. All zero differences retained in N, means, SD and dz denominator.',
    missing_rule: 'N<2 has no t/CI/dz; zero SD leaves t/dz blank'
  }, {
    topic: 'Wilcoxon',
    formula: 'Zero differences removed for signed rank only; exact conditional sign permutation through 50 nonzero pairs, normal approximation above 50 with tied-rank variance',
    missing_rule: 'N=0 blank; all zero differences W=0,p=1'
  }, {
    topic: 'Exploration',
    formula: 'Predefined subgroups; participant-level band means; Spearman on paired differences. BH within named exploratory families, at least 2 valid p-values. Ranked by outcome role, paired N and absolute effect.',
    missing_rule: 'No subgroup inference below min_subgroup_n; association inference below min_association_n omitted'
  }, {
    topic: 'pRecall bands',
    formula: 'Fixed supplied pRecall thresholds ' + JSON.stringify(state.cfg.precall_cuts) +
      '; does not change with participant count',
    missing_rule: 'Unknown properties blank, NaN blank. WFlog exported as frequency (log scale).'
  }, {
    topic: 'Quest timing',
    formula: 'mode_durations only; cumulative totals audit-only. Confirmed/placed duplicate locus decision durations counted once. Image changes and selection durations from logged events.',
    missing_rule: 'No event source is missing, never a zero. End-of-mode condition can misattribute transition-spanning intervals.'
  }, {
    topic: 'Layout',
    formula: 'Exact layout file/name link; edges use grid units. wall_length sums edges; layout_complexity counts vertices of degree other than two. Straight-line locus route is not traveled route.',
    missing_rule: 'Unlinked/ambiguous geometry blank; no area or inferred world units'
  }, {
    topic: 'Run safety',
    formula: 'Start Here is marked Running before calculation and Complete only after all outputs/charts. Batches resume automatically; results stay unapproved until completion. Source content hashes, file IDs and raw row provenance remain visible.',
    missing_rule: 'Wait for Complete; failed runs must be rerun before interpretation'
  }];
  v3QuestionMetrics_().forEach(function(d) {
    rows.push({
      topic: d.name,
      formula: 'Mean of ' + d.codes.join(', ') + '; reverse ' + (d.instrument === 'Legacy IPQ' ? state
        .cfg.ipq_reverse_codes.filter(function(c) {
          return d.codes.includes(c);
        }) : d.reverse).join(', ') + ' using 8-x after signed x+4 normalization.',
      scale: state.cfg.questionnaire_scales[d.instrument],
      missing_rule: 'All required integer items valid; no partial means. ' + (d.instrument ===
        'Legacy IPQ' ? 'Endpoint confirmation required; never merged with SUS.' : ''),
      notes: d.name === 'SUS Presence' ?
        'Slater-Usoh-Steed six-item presence. High count requires six complete answers.' : d.name ===
        'Germane Cognitive Load' ?
        'Preserved two-item main definition; three-item variant separate exploratory.' : ''
    });
  });
  v3QuestionDefinitions_().forEach(function(d) {
    rows.push({
      topic: 'Item ' + d.code,
      formula: d.aliases.join(' | '),
      notes: d.instrument + ' / ' + d.subscale
    });
  });
  mapping.forEach(function(m) {
    rows.push({
      topic: 'Observed header mapping',
      source: m.source,
      column: m.column,
      header: m.header,
      code: m.code,
      notes: m.status
    });
  });
  return rows;
}

function v3WriteOutputs_(result, state, queue, step) {
  step = step || function(name, work) { return work(); };
  const write = function(name, rows, headers) {
    step('table:' + name, function() { v3WriteGenerated_(name, rows, headers); });
  };
  const missing = v3Missing_(result.trials, result.questions, state);
  const stats = result.stats;
  const errors = result.issues.filter(function(i) {
    return i.severity === 'Error';
  });
  const pending = queue.filter(function(q) {
    return q.review_status === 'Current' && q.current_scoring_result === 'Not counted' && q
      .researcher_decision === 'Unreviewed';
  });
  const summary = [];
  stats.forEach(function(s) {
    s.pairs.forEach(function(p) {
      summary.push(Object.assign({
        metric: s.metric
      }, p));
    });
  });
  write('Data Quality', result.issues, ['severity', 'code', 'source', 'participant_id', 'detail',
    'action'
  ]);
  write('Missing Data', missing);
  const statsHeaders = ['metric', 'role', 'paired_n', 'generic_mean', 'generic_sd', 'personalized_mean',
    'personalized_sd', 'mean_difference', 'median_difference', 'ci95_low', 'ci95_high', 'paired_t', 'df',
    'p', 'cohens_dz', 'wilcoxon_w', 'wilcoxon_p', 'wilcoxon_method', 'personalized_wins', 'generic_wins',
    'ties', 'missing_pairs', 'direction', 'favors', 'interpretation', 'warning'
  ];
  write('Key Results', stats, statsHeaders);
  write('Session Order', result.sessionOrder, ['metric', 'role', 'timepoint', 'field',
    'paired_n', 'first_mean', 'first_sd', 'second_mean', 'second_sd', 'mean_difference',
    'median_difference', 'ci95_low', 'ci95_high', 'paired_t', 'df', 'p', 'cohens_dz', 'wilcoxon_w',
    'wilcoxon_p', 'wilcoxon_method', 'second_better', 'first_better', 'ties',
    'all_improvements_second', 'missing_pairs', 'direction', 'interpretation', 'warning'
  ]);
  write('Interesting Findings', result.findings, statsHeaders.concat(['family', 'q',
    'effect_estimate', 'sample_n'
  ]));
  write('Participant Summary', summary);
  write('Recall Trials', result.trials.map(function(t) {
    const r = Object.assign({}, t, t.metrics);
    delete r.audit;
    delete r.metrics;
    delete r.target_items;
    return r;
  }));
  write('Recall Item Level', result.items);
  write('Questionnaire Scores', result.questions);
  const questOutput = [];
  result.quest.forEach(function(q) {
    const s = Object.assign({
      row_type: 'Summary'
    }, q);
    delete s.raw_events_json;
    questOutput.push(s);
    JSON.parse(q.raw_events_json || '[]').forEach(function(e) {
      questOutput.push({
        row_type: 'Source event',
        record_id: q.record_id,
        participant_id: q.participant_id,
        palace_condition: q.palace_condition,
        file_id: e.file_id,
        event_type: e.type,
        source_row: e.row.__row_number,
        raw_row_json: JSON.stringify(e.row),
        status: q.status
      });
    });
  });
  write('Quest Metrics', questOutput);
  write('Word Results', v3WordResults_(result.items));
  write('Model Export', result.items);
  step('correlations', function() { v3WriteCorrelationOutputs_(result); });
  write('Import Audit', result.importAudit);
  write('Data Dictionary', v3Dictionary_(state, result.questionMapping));
  step('validation', function() {
    const tests = v3ValidationResults_();
    v3WriteGenerated_('Test Results', tests, ['test', 'status', 'details']);
    if (tests.some(function(t) { return t.status === 'FAIL'; })) throw new Error('V3 validation tests failed');
  });
  v3CreateCharts_(result, state.cfg, step);
  const start = [{
    topic: 'Run status',
    value: 'Complete',
    detail: errors.length ? 'Review blockers before interpretation.' :
      'Ready for researcher review; confirm pending word decisions.',
    open_next: errors.length ? 'V3 Data Quality' : pending.length ? 'V3 Word Review Queue' :
      'V3 Key Results'
  }, {
    topic: 'Safe to interpret?',
    value: errors.length ? 'No — blocking data-quality errors' : pending.length ?
      'Provisional — word review pending' : stats[0] && stats[0].paired_n ?
      'Ready with stated uncertainty' : 'No complete primary pairs',
    detail: errors.length + ' blocking errors; ' + pending.length + ' unreviewed uncounted responses'
  }, {
    topic: 'New / changed source files',
    value: result.importAudit.filter(function(a) {
      return a.change === 'New';
    }).length + ' new; ' + result.importAudit.filter(function(a) {
      return a.change === 'Changed';
    }).length + ' changed',
    open_next: 'V3 Import Audit'
  }, {
    topic: 'Incomplete participants',
    value: v3Unique_(missing.filter(function(r) {
      return r.status !== 'Present';
    }).map(function(r) {
      return r.participant_id;
    })).join('; '),
    open_next: 'V3 Missing Data'
  }, {
    topic: 'New participants awaiting review',
    value: state.registry.filter(function(r) {
      return r.review_status === 'Review';
    }).map(function(r) {
      return r.canonical_participant_id;
    }).join('; '),
    open_next: 'V3 Participant Registry'
  }, {
    topic: 'Word review',
    value: pending.length,
    detail: 'Choose decision, replacement target and scope; run Apply Word Decisions and Recalculate.',
    open_next: 'V3 Word Review Queue'
  }];
  stats.filter(function(s) {
    return /^Predeclared/.test(s.role) || ['IMI Interest/Enjoyment', 'IMI Perceived Competence',
      'SUS Presence'
    ].includes(s.metric);
  }).forEach(function(s) {
    start.push({
      topic: s.metric,
      value: 'Generic ' + s.generic_mean + ' | Personalized ' + s.personalized_mean + ' | paired N=' +
        s.paired_n,
      detail: s.interpretation,
      open_next: 'V3 Key Results'
    });
  });
  step('finish', function() {
    v3ApplySheetVisibility_();
    v3WriteGenerated_('Start Here', start, ['topic', 'value', 'detail', 'open_next']);
    const sh = v3Sheet_('Start Here');
    sh.setColumnWidths(1, 4, 300);
    sh.getDataRange().setWrap(true);
    SpreadsheetApp.getActive().setActiveSheet(sh);
  });
}
