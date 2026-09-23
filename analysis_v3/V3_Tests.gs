/* Shared deterministic suite: runnable in Node and the Apps Script menu. */
function v3Assert_(value, message) {
  if (!value) throw new Error(message || 'Assertion failed');
}

function v3Equal_(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Expected ' + JSON.stringify(
    expected) + '; got ' + JSON.stringify(actual));
}

function v3Near_(actual, expected, tol) {
  v3Assert_(typeof actual === 'number' && Math.abs(actual - expected) <= (tol || 1e-10), 'Expected ' +
    expected + '; got ' + actual);
}

function v3FixtureState_() {
  return {
    cfg: v3Defaults_(),
    registry: v3RegistryDefaults_(),
    conditionOverrides: v3ConditionDefaults_(),
    sessionOverrides: [],
    fileDecisions: [],
    wordDecisions: []
  };
}

function v3FixtureTrial_(responses, words) {
  return {
    record_id: 'test-trial',
    participant_id: 'Sarah Hanna',
    palace_condition: 'Generic',
    list_id: 'List1',
    word_list_set: 'Memory List',
    timepoint: 'Immediate',
    responses: responses,
    target_words: words,
    target_signature: v3TargetSignature_(words),
    status: 'Include'
  };
}

function v3TestCases_() {
  return [
    ['analysis resumes only unfinished steps and retries failures', function() {
      let job = { done: {} }, calls = [], expired = false;
      const pause = {};
      const check = function() { if (expired) throw pause; };
      const run = function(name, work) { return v3RunStep_(job, name, work, check); };
      run('first', function() { calls.push('first'); });
      expired = true;
      run('first', function() { throw new Error('Repeated completed step'); });
      try { run('second', function() { calls.push('second'); }); }
      catch (e) { v3Assert_(e === pause); }
      v3Equal_(calls, ['first']);
      v3Assert_(!job.done.second);
      job = JSON.parse(JSON.stringify(job));
      expired = false;
      try { run('second', function() { throw new Error('Temporary failure'); }); } catch (e) {}
      v3Assert_(!job.done.second);
      run('second', function() { calls.push('second'); });
      v3Equal_(calls, ['first', 'second']);
      v3Assert_(job.done.second);
    }],
    ['four authoritative conditions', function() {
      const cfg = v3Defaults_();
      [
        ['A.1', 'Generic', 'List1'],
        ['A.2', 'Generic', 'List2'],
        ['B.1', 'Personalized', 'List2'],
        ['B.2', 'Personalized', 'List1']
      ].forEach(function(a) {
        const d = v3ResolveCondition_(a[0], cfg);
        v3Equal_([d.palace_condition, d.list_id], a.slice(1));
      });
    }],
    ['unsuffixed A/B unresolved', function() {
      ['A', 'B', 'Condition A', 'ConditionB'].forEach(function(c) {
        v3Equal_(v3ResolveCondition_(c).recognized, false);
      });
    }],
    ['verified Quest session override supersedes placeholder metadata', function() {
      const s = v3FixtureState_();
      s.registry = v3RegistryDefaults_();
      s.sessionOverrides = v3DefaultQuestSessionOverrides_();
      const r = v3Metadata_({
        session_id: '20260901_203508_eca8a611',
        participant_id: 'MIREILLE',
        condition_code: 'B.1'
      }, {
        id: 'f'
      }, 'quest', s, [], 'quest');
      v3Equal_([r.participant_id, r.condition_code, r.status], ['Sandra Rami', 'B.1', 'Include']);
      v3Equal_(v3Unique_(s.sessionOverrides.map(function(o) {
        return o.session_id;
      })).length, s.sessionOverrides.length);
    }],
    ['all known aliases and Micho exclusion', function() {
      const r = v3RegistryDefaults_();
      ['Iten', 'Sarah', 'Mareez', 'Kiro', 'Georges', 'Peter', 'CAMY', 'Michael-l', 'Micho'].forEach(
        function(a) {
          v3Equal_(v3ResolveParticipant_(a, r).status, 'Resolved');
        });
      v3Equal_(v3ResolveParticipant_('Micho', r).record.inclusion_exclusion, 'Exclude');
    }],
    ['Georges special source mapping', function() {
      const s = v3FixtureState_();
      const a = v3Metadata_({
        participant_id: 'Georges',
        condition: 'Condition A',
        'After 24 Hours': false
      }, {
        id: 'f'
      }, 'r', s, [], 'recall');
      v3Equal_([a.condition_code, a.list_id, a.word_source_key, a.palace_condition], ['A.2', 'List2',
        'MemoryB', 'Generic'
      ]);
      const b = v3Metadata_({
        participant_id: 'Georges',
        condition: 'Condition B',
        'After 24 Hours': false
      }, {
        id: 'f'
      }, 'r', s, [], 'recall');
      v3Equal_([b.condition_code, b.list_id, b.word_source_key, b.palace_condition], ['B.2', 'List1',
        'MemoryA', 'Personalized'
      ]);
    }],
    ['timepoints explicit and legacy', function() {
      ['Immediate', 'Delayed24h', 'Delayed1Week'].forEach(function(t) {
        v3Equal_(v3Timepoint_({
          Timepoint: t
        }), t);
      });
      v3Equal_(v3Timepoint_({
        'After 24 Hours': true
      }), 'Delayed24h');
      v3Equal_(v3Timepoint_({
        'After 24 Hours': false
      }), 'Immediate');
      v3Equal_(v3Timepoint_({
        Timepoint: 'Week-delayed recall',
        'After 24 Hours': false
      }), 'Delayed1Week');
    }],
    ['missing/invalid timepoints never immediate', function() {
      [{}, {
        'After 24 Hours': 'maybe'
      }, {
        Timepoint: 'nonsense',
        'After 24 Hours': false
      }].forEach(function(r) {
        v3Equal_(v3Timepoint_(r), '');
      });
    }],
    ['exact plural spelling fuzzy semantic intrusion', function() {
      const cfg = v3Defaults_(),
        t = v3FixtureTrial_(['cat', 'eggs', 'rasberry', 'calender', 'cap', 'doctor'], ['cat', 'egg',
          'raspberry', 'calendar', 'hat'
        ]);
      const a = v3MatchTrial_(t, [], cfg),
        m = v3SequenceMetrics_(a, t.target_words);
      v3Equal_(m.correct_unique, 3);
      v3Equal_(a[3].match_method, 'Fuzzy suggestion');
      v3Equal_(a[4].match_method, 'Semantic suggestion');
      v3Equal_(a[5].match_method, 'Intrusion');
      v3Equal_(m.near_misses, 2);
    }],
    ['manual approval changes score and persists', function() {
      const cfg = v3Defaults_(),
        t = v3FixtureTrial_(['calender'], ['calendar']);
      t.audit = v3MatchTrial_(t, [], cfg);
      v3Equal_(v3SequenceMetrics_(t.audit, t.target_words).correct_unique, 0);
      const q = v3QueueRows_([t]);
      q[0].researcher_decision = 'Count as suggested target';
      const compiled = v3CompileDecisions_(q, [], 'fixed');
      for (let i = 0; i < 3; i++) v3Equal_(v3SequenceMetrics_(v3MatchTrial_(t, v3Clone_(compiled
        .additions), cfg), t.target_words).correct_unique, 1);
    }],
    ['manual incorrect overrides exact', function() {
      const cfg = v3Defaults_(),
        t = v3FixtureTrial_(['cat'], ['cat']);
      t.audit = v3MatchTrial_(t, [], cfg);
      const q = v3QueueRows_([t]);
      q[0].researcher_decision = 'Count as incorrect/intrusion';
      const r = v3CompileDecisions_(q, [], 'fixed').additions;
      v3Equal_(v3SequenceMetrics_(v3MatchTrial_(t, r, cfg), t.target_words).correct_unique, 0);
    }],
    ['decision scopes and equal-level conflicts', function() {
      const cfg = v3Defaults_(),
        t = v3FixtureTrial_(['cat'], ['cat', 'dog']);
      const id = v3ReviewId_(t, 1, 'cat');
      const rules = [{
        rule_id: 'global',
        active: true,
        scope: 'Global spelling/alias rule',
        normalized_response: 'cat',
        decision: 'incorrect'
      }, {
        rule_id: 'participant',
        active: true,
        scope: 'This participant and list',
        participant_id: t.participant_id,
        list_id: t.list_id,
        word_list_set: t.word_list_set,
        target_signature: t.target_signature,
        normalized_response: 'cat',
        decision: 'correct',
        target_word: 'cat'
      }];
      v3Equal_(v3MatchTrial_(t, rules, cfg)[0].matched_target, 'cat');
      rules.push({
        rule_id: 'occurrence',
        active: true,
        scope: 'This occurrence only',
        review_id: id,
        normalized_response: 'cat',
        decision: 'incorrect'
      });
      v3Equal_(v3MatchTrial_(t, rules, cfg)[0].matched_target, '');
      rules.push(Object.assign({}, rules[2], {
        rule_id: 'conflict',
        decision: 'correct',
        target_word: 'dog'
      }));
      v3Equal_(v3MatchTrial_(t, rules, cfg)[0].conflict, true);
    }],
    ['scope cannot leak to different list set', function() {
      const cfg = v3Defaults_(),
        t = v3FixtureTrial_(['cat'], ['cat']);
      const r = {
        rule_id: 'r',
        active: true,
        scope: 'This participant and list',
        participant_id: t.participant_id,
        list_id: t.list_id,
        word_list_set: 'Hard Memory List',
        target_signature: t.target_signature,
        normalized_response: 'cat',
        decision: 'incorrect'
      };
      v3Equal_(v3MatchTrial_(t, [r], cfg)[0].matched_target, 'cat');
    }],
    ['repetitions never increase unique recall', function() {
      const t = v3FixtureTrial_(['cat', 'cat', 'doctor', 'doctor'], ['cat', 'dog']);
      const m = v3SequenceMetrics_(v3MatchTrial_(t, [], v3Defaults_()), t.target_words);
      v3Equal_([m.correct_unique, m.repetitions, m.intrusions], [1, 2, 2]);
    }],
    ['blank slots preserve positions and order', function() {
      const row = {
        'Recalled Word 1': 'cat',
        'Recalled Word 2': '',
        'Recalled Word 3': 'moon'
      };
      const t = v3FixtureTrial_(v3ResponseSlots_(row), ['cat', 'dog', 'moon']);
      const m = v3SequenceMetrics_(v3MatchTrial_(t, [], v3Defaults_()), t.target_words);
      v3Equal_([m.exact_position_matches, m.lcs, m.mean_absolute_displacement], [2, 2, 0]);
    }],
    ['LCS Kendall adjacency and displacement', function() {
      const t = v3FixtureTrial_(['dog', 'cat', 'moon'], ['cat', 'dog', 'moon']);
      const m = v3SequenceMetrics_(v3MatchTrial_(t, [], v3Defaults_()), t.target_words);
      v3Equal_([m.lcs, m.adjacent_correct_pairs], [2, 0]);
      v3Near_(m.kendall, 1 / 3);
      v3Near_(m.mean_absolute_displacement, 2 / 3);
    }],
    ['Timed false/unknown stay missing; duration units', function() {
      v3Equal_(v3Duration_({
        Timed: false,
        'Recall Duration (seconds)': 22
      }), '');
      v3Equal_(v3Duration_({
        'Recall Duration (seconds)': 22
      }), '');
      v3Equal_(v3Duration_({
        Timed: true,
        'Recall Duration (milliseconds)': 2200
      }), 2.2);
    }],
    ['IMI reverse keys', function() {
      const cfg = v3Defaults_(),
        d = v3QuestionMetrics_().find(function(d) {
          return d.name === 'IMI Perceived Competence';
        });
      const raw = {};
      d.codes.forEach(function(c) {
        raw[c] = 7;
      });
      const score = v3ScoreScale_(raw, d, cfg);
      v3Equal_(score.value, 6);
    }],
    ['questionnaire missing and out-of-range values', function() {
      const cfg = v3Defaults_(),
        d = v3QuestionMetrics_()[0];
      const raw = {};
      d.codes.forEach(function(c) {
        raw[c] = 4;
      });
      raw.IMI_IE_1 = 8;
      v3Equal_(v3ScoreScale_(raw, d, cfg).value, '');
      raw.IMI_IE_1 = '';
      v3Equal_(v3ScoreScale_(raw, d, cfg).value, '');
    }],
    ['SUS and IPQ separate, signed normalized', function() {
      const cfg = v3Defaults_();
      cfg.questionnaire_scales['SUS Presence'] = 'signed';
      const d = v3QuestionMetrics_().find(function(d) {
          return d.name === 'SUS Presence';
        }),
        raw = {};
      d.codes.forEach(function(c) {
        raw[c] = 3;
      });
      v3Equal_(v3ScoreScale_(raw, d, cfg).value, 7);
      v3Assert_(v3QuestionMetrics_().filter(function(d) {
        return d.instrument === 'Legacy IPQ';
      }).length === 4);
    }],
    ['unconfirmed IPQ keys block scores', function() {
      const cfg = v3Defaults_(),
        d = v3QuestionMetrics_().find(function(d) {
          return d.name === 'Legacy IPQ General';
        });
      v3Equal_(v3ScoreScale_({
        IPQ_G1: '+3'
      }, d, cfg).value, '');
      cfg.ipq_keys_confirmed = true;
      v3Equal_(v3ScoreScale_({
        IPQ_G1: '+3'
      }, d, cfg).value, 7);
    }],
    ['complete pairs only; no zero imputation', function() {
      const rows = [{
        participant_id: 'p1',
        palace_condition: 'Generic',
        status: 'Include',
        value: 0.4
      }, {
        participant_id: 'p1',
        palace_condition: 'Personalized',
        status: 'Include',
        value: 0.6
      }, {
        participant_id: 'p2',
        palace_condition: 'Generic',
        status: 'Include',
        value: 0.9
      }];
      const p = v3Pairs_(rows, function(r) {
        return r.value;
      }, ['p1', 'p2', 'p3']);
      v3Equal_(p.pairs.length, 1);
      v3Equal_(p.missing_pairs, 2);
      v3Near_(p.pairs[0].difference, 0.2);
    }],
    ['zero differences retained in t and dz', function() {
      const r = v3PairedTTest_([0, -0.35]);
      v3Equal_(r.n, 2);
      v3Near_(r.t, -1);
      v3Near_(r.p, 0.5);
      v3Near_(r.cohens_dz, -1 / Math.sqrt(2));
    }],
    ['t critical remains t above 30 df', function() {
      v3Near_(v3TCritical_(40), 2.021075390306273, 1e-8);
    }],
    ['Wilcoxon exact with zeros/ties and BH', function() {
      v3Equal_(v3Wilcoxon_([1, 2, 3, 4]).p, 0.125);
      v3Equal_(v3Wilcoxon_([0, 0]).p, 1);
      const a = [.01, .03, .04].map(function(p) {
        return {
          role: 'Exploratory',
          family: 'x',
          p: p
        };
      });
      v3BH_(a);
      v3Near_(a[0].q, .03);
      v3Near_(a[1].q, .04);
    }],
    ['duplicate sources blocked despite Include', function() {
      const a = [{
        record_id: 'a',
        participant_id: 'p',
        palace_condition: 'Generic',
        timepoint: 'Immediate',
        status: 'Include'
      }, {
        record_id: 'b',
        participant_id: 'p',
        palace_condition: 'Generic',
        timepoint: 'Immediate',
        status: 'Include'
      }];
      v3RejectDuplicates_(a, [], 'recall');
      v3Equal_(a.map(function(r) {
        return r.status;
      }), ['Duplicate', 'Duplicate']);
    }],
    ['stable IDs independent of source hash', function() {
      const row = {
        __row_number: 2,
        'Start Timestamp (ISO 8601)': 'stamp'
      };
      v3Equal_(v3TrialId_({
        id: 'f',
        hash: 'a'
      }, row), v3TrialId_({
        id: 'f',
        hash: 'b'
      }, row));
      const t = v3FixtureTrial_(['cat'], ['cat']);
      v3Assert_(v3ReviewId_(t, 1, 'cat') !== v3ReviewId_(t, 1, 'dog'));
    }],
    ['review queue merge preserves manual columns and stale records', function() {
      const t = v3FixtureTrial_(['calender'], ['calendar']);
      t.audit = v3MatchTrial_(t, [], v3Defaults_());
      const a = v3QueueRows_([t]);
      a[0].researcher_decision = 'Count as suggested target';
      a[0].notes = 'Keep me';
      const merged = v3MergeQueue_(a, v3QueueRows_([t]));
      v3Equal_(merged[0].notes, 'Keep me');
      v3Equal_(merged[0].researcher_decision, 'Count as suggested target');
      v3Equal_(v3MergeQueue_(merged, [])[0].review_status, 'Stale source occurrence; retained for audit');
    }],
    ['new participants reviewed without fuzzy merge', function() {
      const reg = v3RegistryDefaults_(),
        add = v3Discover_([{
          raw: 'New Person',
          condition: 'A.1',
          source: 'f'
        }, {
          raw: 'New Person',
          condition: 'B.1',
          source: 'g'
        }], reg);
      v3Equal_(add.length, 1);
      v3Equal_(add[0].inclusion_exclusion, 'Review');
      v3Equal_(v3Discover_([{
        raw: 'New Person'
      }], reg.concat(add)).length, 0);
    }],
    ['CSV quoting blank rows physical provenance', function() {
      const p = v3ParseCsv_('a,b\n"x,y",z\n,\nfoo,bar');
      v3Equal_(p.rows[0].a, 'x,y');
      v3Equal_(p.rows[1].__row_number, 4);
    }],
    ['IMI competence present in main comparisons', function() {
      const s = v3FixtureState_(),
        stats = v3BuildStatistics_([], [], [], s);
      v3Assert_(stats.some(function(r) {
        return r.metric === 'IMI Perceived Competence';
      }));
    }],
    ['one week appears without code edits', function() {
      const s = v3FixtureState_(),
        t = v3FixtureTrial_(['cat'], ['cat']);
      t.timepoint = 'Delayed1Week';
      t.metrics = {
        proportion_correct: 1,
        correct_unique: 1,
        lcs_proportion: 1,
        kendall: ''
      };
      const stats = v3BuildStatistics_([t], [], [], s);
      v3Assert_(stats.some(function(r) {
        return r.metric === 'Delayed1Week — Recall accuracy';
      }));
    }],
    ['tiny subgroups have no inferential p/CI', function() {
      const s = v3PairSummary_({
        pairs: [{
          generic: .1,
          personalized: .2,
          difference: .1
        }, {
          generic: .2,
          personalized: .4,
          difference: .2
        }],
        missing_pairs: 0
      }, 'test', 'Exploratory', 1, v3Defaults_(), false);
      v3Equal_([s.p, s.ci95_low, s.paired_t, s.wilcoxon_p], ['', '', '', '']);
    }],
    ['layout schema grid units not fabricated meters', function() {
      const g = v3LayoutGeometry_({
        edges: [{
          A: {
            x: 0,
            y: 0
          },
          B: {
            x: 3,
            y: 4
          }
        }],
        cellSize: .15
      });
      v3Equal_(g.wall_length, 5);
      v3Equal_(g.layout_units, 'grid steps (not world meters)');
    }],
    ['no hardcoded 25-word scorer', function() {
      const words = Array.from({
          length: 30
        }, function(_, i) {
          return 'target ' + i;
        }),
        t = v3FixtureTrial_(words, words);
      v3Equal_(v3SequenceMetrics_(v3MatchTrial_(t, [], v3Defaults_()), words).proportion_correct, 1);
    }],
    ['session-order pairs require one first and one second trial', function() {
      const records = [{
        participant_id: 'p1', period: 1, status: 'Include', value: 0.2
      }, {
        participant_id: 'p1', period: 2, status: 'Include', value: 0.5
      }, {
        participant_id: 'p2', period: 1, status: 'Include', value: 0.8
      }, {
        participant_id: 'p2', period: 2, status: 'Include', value: 0.4
      }, {
        participant_id: 'p3', period: 2, status: 'Include', value: 0.7
      }, {
        participant_id: 'p4', period: 3, status: 'Include', value: 0.9
      }];
      const pairs = v3PeriodPairs_(records, function(r) {
        return r.value;
      }, ['p1', 'p2', 'p3']);
      v3Equal_(pairs.pairs.map(function(p) {
        return [p.participant_id, p.first, p.second, p.difference];
      }), [['p1', 0.2, 0.5, 0.3], ['p2', 0.8, 0.4, -0.4]]);
      v3Equal_([pairs.expected_n, pairs.missing_pairs], [3, 1]);
      const summary = v3PeriodPairSummary_(pairs, 'Test metric', 1, v3Defaults_());
      v3Equal_([summary.second_better, summary.first_better, summary.ties,
        summary.all_improvements_second
      ], [1, 1, 0, 'No']);
    }],
    ['reader sheets exclude backend outputs', function() {
      const visible = v3ReaderSheetNames_();
      v3Assert_(visible.includes('Start Here'), 'Start Here must remain visible');
      v3Assert_(visible.includes('Session Order'), 'Session Order must remain visible');
      v3Assert_(!visible.includes('Recall Item Level'), 'item-level backend must stay hidden');
      v3Assert_(!visible.includes('Test Results'), 'test output must stay hidden');
    }],
    ['variable comparison pairs only matching participant-condition values', function() {
      const result = {
        trials: [{
          participant_id: 'p1', palace_condition: 'Generic', timepoint: 'Immediate', status: 'Include',
          metrics: { proportion_correct: 0.2 }
        }, {
          participant_id: 'p2', palace_condition: 'Generic', timepoint: 'Immediate', status: 'Include',
          metrics: { proportion_correct: 0.8 }
        }, {
          participant_id: 'p3', palace_condition: 'Personalized', timepoint: 'Immediate', status: 'Include',
          metrics: { proportion_correct: 0.5 }
        }],
        questions: [{
          participant_id: 'p1', palace_condition: 'Generic', status: 'Include', metric: 'Test scale', value: 2
        }, {
          participant_id: 'p2', palace_condition: 'Generic', status: 'Include', metric: 'Test scale', value: 8
        }, {
          participant_id: 'p3', palace_condition: 'Personalized', status: 'Include', metric: 'Test scale', value: 5
        }],
        quest: []
      };
      const pairs = v3CorrelationPairs_(v3CorrelationValues_(result), 'Recall | Immediate | proportion correct',
        'Questionnaire | Test scale');
      v3Equal_(pairs.length, 3);
      v3Equal_(pairs.filter(function(p) { return p.palace_condition === 'Generic'; }).length, 2);
      v3Equal_(pairs.filter(function(p) { return p.palace_condition === 'Personalized'; }).length, 1);
      v3Near_(v3Pearson_(pairs.map(function(p) { return p.x; }), pairs.map(function(p) { return p.y; })), 1);
    }]
  ];
}

function v3ValidationResults_() {
  return v3TestCases_().map(function(t) {
    try {
      t[1]();
      return {
        test: t[0],
        status: 'PASS',
        details: ''
      };
    } catch (e) {
      return {
        test: t[0],
        status: 'FAIL',
        details: e.message
      };
    }
  });
}
