/* Central definitions. Editable overrides are persisted in V3 Settings. */

function v3DefaultRegistryRows_() {
  return [
    ['Iten Wafik', 'Iten; ITEN', '', 'Unknown', '', 'Include', '',
      'Current participant and filename aliases.'
    ],
    ['Sarah Hanna', 'Sarah; SARAH', '', 'Unknown', '', 'Include', '',
      'Current participant and filename aliases.'
    ],
    ['Mareez Hanna', 'Mareez; Mareez hanna; MAREEZ', '', 'Unknown', '', 'Include', '',
      'Current participant and Quest filename aliases.'
    ],
    ['Kirollos', 'Kirolos; Kiro; KIROLOS SROOR; KIROLLOS SROOR', '', 'Unknown', '', 'Include', '',
      'Known spelling and full-name aliases.'
    ],
    ['Georges Sameh', 'Georges; George; Georges-sameh', '', 'Unknown', '', 'Include', '',
      'Current files use Memory B for Condition A and Memory A for Condition B.'
    ],
    ['Peter Osama', 'Peter; PETER OSAMA; Peter-Osama', '', 'Unknown', '', 'Include', '',
      'Current recitation filename aliases.'
    ],
    ['Camy', 'CAMY', '', 'Unknown', '', 'Include', '', 'Current recitation filename alias.'],
    ['Michael L', 'MICHAEL L; Michael-l; Michael l', '', 'Unknown', '', 'Include', '',
      'Current recitation filename aliases.'
    ],
    ['Wegweg', 'WEGWEG', '', 'Unknown', '', 'Include', '',
      'Quest session identity confirmed by its recorded participant ID.'
    ],
    ['Mireille', 'MIREILLE', '', 'Unknown', '', 'Include', '',
      'Quest session identity confirmed by its recorded participant ID.'
    ],
    ['Sandra Rami', 'SANDRA RAMI', '', 'Unknown', '', 'Include', '',
      'Quest metadata incorrectly says MIREILLE; see the timestamped Session Override.'
    ],
    ['Mariam R', 'MARIAM R', '', 'Unknown', '', 'Include', '',
      'Quest session identity confirmed by its recorded participant ID.'
    ],
    ['Hadoora', 'HADOORA', '', 'Unknown', '', 'Include', '',
      'Quest metadata was FINAL; see the timestamped Session Override.'
    ],
    ['Azmey', 'AZMEY', '', 'Unknown', '', 'Include', '',
      'Quest metadata was FINAL; see the timestamped Session Override.'
    ],
    ['Sameh', 'SAMEH', '', 'Unknown', '', 'Include', '',
      'Quest metadata was FINAL; see the timestamped Session Override.'
    ],
    ['Bassam', 'BASSAM', '', 'Unknown', '', 'Include', '',
      'Quest session identity confirmed by its recorded participant ID.'
    ],
    ['Michel Gamal', 'Micho', '', 'Unknown', '', 'Exclude',
      'Original list not found; intentionally excluded pending manual recovery.',
      'Micho is excluded until the original list is recovered.'
    ]
  ];
}

/* Verified once from the Runs sheet using the local date, valid recorded ID, then non-training
 * condition order. Runs has no time-of-day, so these are explicit audit records, not a live heuristic. */
function v3DefaultQuestSessionOverrides_() {
  const matched = 'Matched to Runs using local date, recorded ID where valid, and non-training condition order; Runs has no clock time.';
  return [
    ['20260824_181334_88bd8c2c', 'Georges Sameh', 'Metadata ID GEORGES SAMEH confirms this session.'],
    ['20260825_181723_868fb452', 'Camy', 'Metadata ID FINAL; matched 25 Aug B.1|A.1 run.'],
    ['20260825_212203_ab13b092', 'Michael L', 'Metadata ID FINAL; remaining 25 Aug run with B.2|B.1|A.1.'],
    ['20260827_182817_c5b872e5', 'Peter Osama', 'Metadata ID FINAL; only 27 Aug B.2|A.2 run.'],
    ['20260829_143652_b5840271', 'Wegweg', 'Metadata ID WEGWEG confirms this session.'],
    ['20260829_202235_59dd7e61', 'Mireille', 'Metadata ID MIREILLE confirms this session.'],
    ['20260901_203508_eca8a611', 'Sandra Rami', 'Metadata ID incorrectly says MIREILLE; matched 1 Sep B.1|A.1 run.'],
    ['20260904_123634_9133a312', 'Mariam R', 'Metadata ID MARIAM R confirms this session; Runs order needs separate review.'],
    ['20260904_145055_b472571d', 'Hadoora', 'Metadata ID FINAL; matched 4 Sep B.2|A.2 run.'],
    ['20260904_171735_71e54117', 'Azmey', 'Metadata ID FINAL; matched 4 Sep B.1|A.1 run.'],
    ['20260905_191257_35de5214', 'Sameh', 'Metadata ID FINAL; matched 5 Sep B.2|A.2 run.'],
    ['20260905_204222_9a8ec317', 'Bassam', 'Metadata ID BASSAM confirms this session.']
  ].map(function(r) {
    return {
      session_id: r[0],
      participant_id_override: r[1],
      reason: 'Runs-sheet identity match',
      notes: matched + ' ' + r[2]
    };
  });
}


function v3DefaultParticipantConditionRows_() {
  return [
    ['Sarah Hanna', 'Condition A', 'B.1', 'ConditionA', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Sarah Hanna', 'Condition B', 'A.1', 'ConditionB', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Mareez Hanna', 'Condition A', 'A.1', 'ConditionA', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Mareez Hanna', 'Condition B', 'B.1', 'ConditionB', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Iten Wafik', 'Condition A', 'B.1', 'ConditionA', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Iten Wafik', 'Condition B', 'A.1', 'ConditionB', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Kirollos', 'Condition A', 'A.2', 'ConditionA', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Kirollos', 'Condition B', 'B.2', 'ConditionB', '', '', '', '', '',
      'Supplied current-participant mapping.', ''
    ],
    ['Georges Sameh', 'Condition A', 'A.2', 'MemoryB', '', 'List2', '', '', '',
      'Condition A is Generic with Memory B/List2.', ''
    ],
    ['Georges Sameh', 'Condition B', 'B.2', 'MemoryA', '', 'List1', '', '', '',
      'Condition B is Personalized with Memory A/List1.', ''
    ]
  ];
}


function v3QuestionDefinitions_() {
  const definitions = [];
  const add = function(code, instrument, subscale, item, source, reverse, aliases) {
    definitions.push({
      code: code,
      instrument: instrument,
      subscale: subscale,
      item: item,
      source: source,
      reverse: reverse,
      aliases: aliases.map(v3NormalizeText_)
    });
  };
  add('PARTICIPANT_ID', 'Metadata', 'Participant', 0, 'both', false, ['participant id', 'participant',
    'subject id', 'subject'
  ]);
  add('CONDITION', 'Metadata', 'Condition', 0, 'both', false, ['condition', 'palace condition',
    'condition code', 'experimental condition'
  ]);
  add('TIMESTAMP', 'Metadata', 'Timestamp', 0, 'both', false, ['timestamp', 'submission timestamp']);
  add('PRIOR_VR', 'Metadata', 'Prior VR experience', 0, 'motivation', false, [
    'Have you used virtual reality (VR) before?', 'prior vr experience'
  ]);

  const imi = [
    ['IMI_IE_1', 'Interest/Enjoyment', false, ['I enjoyed doing this activity very much']],
    ['IMI_IE_2', 'Interest/Enjoyment', false, ['This activity was fun to do']],
    ['IMI_IE_3', 'Interest/Enjoyment', true, ['I thought this was a boring activity']],
    ['IMI_IE_4', 'Interest/Enjoyment', true, ['This activity did not hold my attention at all']],
    ['IMI_IE_5', 'Interest/Enjoyment', false, ['I would describe this activity as very interesting']],
    ['IMI_IE_6', 'Interest/Enjoyment', false, ['I thought this activity was quite enjoyable']],
    ['IMI_IE_7', 'Interest/Enjoyment', false, [
      'While I was doing this activity I was thinking about how much I enjoyed it'
    ]],
    ['IMI_PC_1', 'Perceived Competence', false, ['I think I am pretty good at this activity']],
    ['IMI_PC_2', 'Perceived Competence', false, [
      'I think I did pretty well at this activity compared to other students',
      'I think I did pretty well at this activity compared to other participants'
    ]],
    ['IMI_PC_3', 'Perceived Competence', false, [
      'After working at this activity for awhile I felt pretty competent',
      'After working at this activity for a while I felt pretty competent'
    ]],
    ['IMI_PC_4', 'Perceived Competence', false, ['I am satisfied with my performance at this task',
      'I am satisfied with my performance at this activity'
    ]],
    ['IMI_PC_5', 'Perceived Competence', false, ['I was pretty skilled at this activity']],
    ['IMI_PC_6', 'Perceived Competence', true, ['This was an activity that I could not do very well']],
    ['IMI_EI_1', 'Effort/Importance', false, ['I put a lot of effort into this']],
    ['IMI_EI_2', 'Effort/Importance', true, ["I didn't try very hard to do well at this activity"]],
    ['IMI_EI_3', 'Effort/Importance', false, ['I tried very hard on this activity']],
    ['IMI_EI_4', 'Effort/Importance', false, ['It was important to me to do well at this task',
      'It was important to me to do well at this activity'
    ]],
    ['IMI_EI_5', 'Effort/Importance', true, ["I didn't put much energy into this"]]
  ];
  imi.forEach(function(item) {
    add(item[0], 'IMI', item[1], Number(item[0].slice(-1)), 'motivation', item[2], item[3]);
  });

  const sus = [
    ['SUS_1', [
      'Sense of being in the virtual home',
      'Please rate your sense of being in the virtual home, on the following scale from 1 to 7, where 7 represents your normal experience of being in a place.'
    ]],
    ['SUS_2', [
      'Times when the virtual home felt like reality',
      'To what extent were there times during the experience when the virtual home was the reality for you?'
    ]],
    ['SUS_3', [
      'Images seen versus somewhere visited',
      'When you think back about your experience, do you think of the virtual home more as images that you saw, or more as somewhere that you visited?'
    ]],
    ['SUS_4', [
      'Sense of being in the virtual home versus elsewhere',
      'During the time of the experience, which was strongest on the whole, your sense of being in the virtual home, or of being elsewhere?'
    ]],
    ['SUS_5', [
      'Similarity of the memory structure to memories of real places',
      'Consider your memory of being in the virtual home. How similar in terms of the structure of the memory is this to the structure of the memory of other places you have been today?'
    ]],
    ['SUS_6', [
      'Thinking that they were actually in the virtual home',
      'During the time of the experience, did you often think to yourself that you were actually in the virtual home?'
    ]]
  ];
  sus.forEach(function(item, index) {
    add('SUS_' + (index + 1), 'SUS Presence', 'SUS Presence', index + 1, 'motivation', false, item[1]);
  });

  const ipq = [
    ['IPQ_G1', 'General Presence', 1, false, [
      'In the computer generated world I had a sense of being there',
      'In the virtual environment I had a sense of being there'
    ]],
    ['IPQ_SP1', 'Spatial Presence', 1, false, ['Somehow I felt that the virtual world surrounded me']],
    ['IPQ_SP2', 'Spatial Presence', 2, true, ['I felt like I was just perceiving pictures',
      'I felt like I just perceived pictures'
    ]],
    ['IPQ_SP3', 'Spatial Presence', 3, false, ['I did not feel present in the virtual space']],
    ['IPQ_SP4', 'Spatial Presence', 4, false, [
      'I had a sense of acting in the virtual space rather than operating something from outside'
    ]],
    ['IPQ_SP5', 'Spatial Presence', 5, false, ['I felt present in the virtual space']],
    ['IPQ_INV1', 'Involvement', 1, false, [
      'How aware were you of the real world surrounding while navigating in the virtual world ie sounds room temperature other people etc'
    ]],
    ['IPQ_INV2', 'Involvement', 2, false, ['I was not aware of my real environment']],
    ['IPQ_INV3', 'Involvement', 3, true, ['I still paid attention to the real environment']],
    ['IPQ_INV4', 'Involvement', 4, false, ['I was completely captivated by the virtual world']],
    ['IPQ_REAL1', 'Experienced Realism', 1, true, ['How real did the virtual world seem to you']],
    ['IPQ_REAL2', 'Experienced Realism', 2, false, [
      'How much did your experience in the virtual environment seem consistent with your real world experience'
    ]],
    ['IPQ_REAL3', 'Experienced Realism', 3, false, ['How real did the virtual world seem to you']],
    ['IPQ_REAL4', 'Experienced Realism', 4, false, [
      'The virtual world seemed more realistic than the real world'
    ]]
  ];
  ipq.forEach(function(item) {
    add(item[0], 'Legacy IPQ', item[1], item[2], 'motivation', item[3], item[4]);
  });

  const load = [
    ['CL_ICL_1', 'Intrinsic Cognitive Load', 1, false, [
      'For this task many things needed to be kept in mind simultaneously'
    ]],
    ['CL_ICL_2', 'Intrinsic Cognitive Load', 2, false, ['This task was very complex']],
    ['CL_GCL_1', 'Germane Cognitive Load', 1, false, [
      'I made an effort not only to understand several details but to understand the overall context'
    ]],
    ['CL_GCL_2', 'Germane Cognitive Load', 2, false, [
      'My point while dealing with the task was to understand everything correctly'
    ]],
    ['CL_GCL_3', 'Germane Cognitive Load', 3, false, [
      'The learning task consisted of elements supporting my comprehension of the task'
    ]],
    ['CL_ECL_1', 'Extraneous Cognitive Load', 1, false, [
      'During this task it was exhausting to find the important information'
    ]],
    ['CL_ECL_2', 'Extraneous Cognitive Load', 2, false, [
      'The design of this task was very inconvenient for learning'
    ]],
    ['CL_ECL_3', 'Extraneous Cognitive Load', 3, false, [
      'During this task it was difficult to recognize and link the crucial information'
    ]]
  ];
  load.forEach(function(item) {
    add(item[0], 'Cognitive Load', item[1], item[2], 'cognitive', item[3], item[4]);
  });
  return definitions;
}


function v3Defaults_() {
  return {
    version: '3.0.0',
    michel_original_lists_recovered: false,
    experiment_data_root_folder_id: '19wGg7yi-MTBBOl9422X3G6e4u-uKBBnT',
    quest_sessions_folder_id: '1xLepZwMBH22jD6Ezbxdvfb-iuxI6GqKA',
    recitations_folder_id: '1R-ybjgXg7nGDecfESelwb-wysNWIbUkh',
    word_lists_folder_id: '15Q1Z4a85Mf-aT-eGnj_N02YUPFCBhySM',
    layouts_folder_id: '1E0-OEzJYXIGh_g24zTXJKjRGO3Y0S1kr',
    motivation_presence_url: 'https://docs.google.com/spreadsheets/d/1s_O4Z3Hg5uGH9a1lUmsOPjdz7_v3i-cXgnJQKIxd-7k/edit',
    cognitive_load_url: 'https://docs.google.com/spreadsheets/d/1aG0IrLt_e-mXjP4WL0--qg78-nNjxJpyfUX9eXVXpHM/edit',
    questionnaire_tabs: {
      motivation: 'Form Responses 1',
      cognitive: 'Form Responses 1'
    },
    participant_list_sets: {
      'Iten Wafik': 'Condition List',
      'Sarah Hanna': 'Condition List',
      'Mareez Hanna': 'Condition List',
      'Kirollos': 'Condition List',
      'Georges Sameh': 'Memory List',
      'Peter Osama': 'Memory List',
      'Camy': 'Memory List',
      'Michael L': 'Memory List',
      'Wegweg': 'Memory List',
      'MIREILLE': 'Memory List',
      'Mireille': 'Memory List',
      'Sandra Rami': 'Memory List',
      'Mariam R': 'Memory List',
      'Hadoora': 'Memory List',
      'Azmey': 'Memory List',
      'Sameh': 'Memory List',
      'Bassam': 'Memory List'
    },
    migration_source_spreadsheet_id: '',
    word_list_files: [{
      id: '1-wmJc1TUvxS_bQg7K6pWtsdzB2lR_8PS',
      name: 'memory_words_list_A.csv',
      source: 'MemoryA',
      set: 'Memory List',
      list: 'List1',
      expected: 25
    }, {
      id: '1z2AnkhBA9BSxolo3_arQXwo6nhJFYcnR',
      name: 'memory_words_list_B.csv',
      source: 'MemoryB',
      set: 'Memory List',
      list: 'List2',
      expected: 25
    }, {
      id: '1n4jSVSM_gGRO-IWg0aAkBYVe3i-X_y0-',
      name: 'condition_a_words.csv',
      source: 'ConditionA',
      set: 'Condition List',
      list: '',
      expected: 20
    }, {
      id: '1QVeRG-Nd5nUZNA1YD-scxcDvbNBz27ik',
      name: 'condition_b_words.csv',
      source: 'ConditionB',
      set: 'Condition List',
      list: '',
      expected: 20
    }, {
      id: '1rovH9n6dIWk2fikSY-b9kOuw8CsEdnUs',
      name: 'memory_words_list_A_hard.csv',
      source: 'HardMemoryA',
      set: 'Hard Memory List',
      list: 'List1',
      expected: 25
    }, {
      id: '1bwF0Xqx1R2-8ToSAKuUO6nZMWwZAhD22',
      name: 'memory_words_list_B_hard.csv',
      source: 'HardMemoryB',
      set: 'Hard Memory List',
      list: 'List2',
      expected: 25
    }],
    timepoints: [{
      id: 'Immediate',
      hours: 0,
      required: true,
      aliases: ['Immediate', 'Immediately']
    }, {
      id: 'Delayed24h',
      hours: 24,
      required: true,
      aliases: ['Delayed24h', 'Delayed 24h', '24 hours', 'After 24 Hours', '24-hour delayed recall']
    }, {
      id: 'Delayed1Week',
      hours: 168,
      required: false,
      aliases: ['Delayed1Week', 'Delayed 1 Week', '1 Week', 'One week', 'After 1 Week', 'Week-delayed recall',
        '7 days'
      ]
    }],
    min_subgroup_n: 10,
    tiny_sample_n: 10,
    min_association_n: 10,
    precall_cuts: [0.33, 0.67],
    exploratory_enabled: true,
    safe_aliases: {
      rasberry: 'raspberry',
      padel: 'paddle',
      quil: 'quill',
      qwill: 'quill'
    },
    near_miss_aliases: {
      cap: 'hat',
      quirel: 'quill'
    },
    plural_pairs: {
      eggs: 'egg',
      potatoes: 'potato',
      berries: 'berry',
      nails: 'nail',
      sneakers: 'sneaker'
    },
    questionnaire_scales: {
      IMI: 'seven',
      'Cognitive Load': 'seven',
      'SUS Presence': 'seven',
      'Legacy IPQ': 'auto'
    },
    // Source Forms omit endpoint labels for SP3/INV1 and duplicate REAL wording.
    // Confirm against the administered form, then set true; scores stay blank until verified.
    ipq_keys_confirmed: false,
    ipq_reverse_codes: ['IPQ_SP2', 'IPQ_INV3', 'IPQ_REAL1'],
    questionnaire_column_positions: {
      motivation: {
        IPQ_REAL1: 25,
        IPQ_REAL3: 28
      },
      cognitive: {}
    },
    colors: {
      Generic: '#4B78A8',
      Personalized: '#C27637',
      header: '#183B4E'
    },
    condition_map: {
      'A.1': ['Generic', 'List1', '1'],
      'B.2': ['Personalized', 'List1', '2'],
      'A.2': ['Generic', 'List2', '2'],
      'B.1': ['Personalized', 'List2', '1']
    }
  };
}

function v3PersistentHeaders_() {
  return {
    'Settings': ['key', 'value', 'notes'],
    'Participant Registry': ['canonical_participant_id', 'known_aliases', 'prior_vr_experience',
      'counterbalance_group', 'quest_session_ids', 'inclusion_exclusion', 'exclusion_reason', 'notes',
      'review_status', 'suggested_mapping', 'condition_order'
    ],
    'Participant Condition Overrides': ['participant_id', 'source_condition_raw', 'resolved_condition_code',
      'word_source_key', 'palace_condition_override', 'list_id_override', 'counterbalance_group_override',
      'phase_override', 'include', 'reason', 'notes', 'word_list_set', 'period'
    ],
    'Session Overrides': ['session_id', 'participant_id_override', 'palace_condition_override',
      'list_id_override', 'counterbalance_group_override', 'phase_override', 'include', 'reason', 'notes',
      'source_condition_raw', 'condition_code', 'timepoint', 'word_source_key', 'word_list_set',
      'layout_file_id', 'period'
    ],
    'File Decisions': ['file_id', 'include', 'reason', 'notes', 'record_id', 'participant_id',
      'condition_code', 'timepoint', 'word_source_key', 'word_list_set', 'list_id', 'period'
    ],
    'Word Decisions': ['rule_id', 'review_id', 'normalized_response', 'target_word', 'decision', 'scope',
      'participant_id', 'list_id', 'word_list_set', 'target_signature', 'notes', 'decision_timestamp',
      'active', 'origin', 'supersedes'
    ],
    'Word Review Queue': ['review_id', 'participant_id', 'palace_condition', 'list_id', 'word_list_set',
      'timepoint', 'trial_id', 'file_id', 'response_position', 'raw_response', 'normalized_response',
      'suggested_target', 'alternative_targets', 'match_method', 'confidence', 'current_scoring_result',
      'researcher_decision', 'replacement_target', 'scope', 'notes', 'decision_timestamp',
      'target_signature', 'source_hash', 'review_status', 'applied_signature'
    ]
  };
}

function v3GeneratedNames_() {
  return ['Start Here', 'Data Quality', 'Missing Data', 'Key Results', 'Interesting Findings',
    'Participant Summary', 'Session Order', 'Recall Trials', 'Recall Item Level', 'Questionnaire Scores', 'Quest Metrics',
    'Word Results', 'Model Export', 'Variable Data', 'Variable Comparison', 'Charts', 'Import Audit',
    'Data Dictionary', 'Test Results'
  ];
}

function v3DecisionChoices_() {
  return ['Unreviewed', 'Count as suggested target', 'Count as selected target',
    'Count as incorrect/intrusion', 'Ignore response'
  ];
}

function v3Scopes_() {
  return ['This occurrence only', 'This participant and list', 'Global spelling/alias rule'];
}

function v3QuestionMetrics_() {
  const codes = function(prefix, n) {
    return Array.from({
      length: n
    }, function(_, i) {
      return prefix + (i + 1);
    });
  };
  return [{
    name: 'IMI Interest/Enjoyment',
    instrument: 'IMI',
    codes: codes('IMI_IE_', 7),
    reverse: ['IMI_IE_3', 'IMI_IE_4'],
    better: 1
  }, {
    name: 'IMI Perceived Competence',
    instrument: 'IMI',
    codes: codes('IMI_PC_', 6),
    reverse: ['IMI_PC_6'],
    better: 1
  }, {
    name: 'IMI Effort/Importance',
    instrument: 'IMI',
    codes: codes('IMI_EI_', 5),
    reverse: ['IMI_EI_2', 'IMI_EI_5'],
    better: 0
  }, {
    name: 'SUS Presence',
    instrument: 'SUS Presence',
    codes: codes('SUS_', 6),
    reverse: [],
    better: 1
  }, {
    name: 'Intrinsic Cognitive Load',
    instrument: 'Cognitive Load',
    codes: codes('CL_ICL_', 2),
    reverse: [],
    better: -1
  }, {
    name: 'Germane Cognitive Load',
    instrument: 'Cognitive Load',
    codes: codes('CL_GCL_', 2),
    reverse: [],
    better: 0
  }, {
    name: 'Germane Cognitive Load (3-item exploratory)',
    instrument: 'Cognitive Load',
    codes: codes('CL_GCL_', 3),
    reverse: [],
    better: 0,
    role: 'Exploratory'
  }, {
    name: 'Extraneous Cognitive Load',
    instrument: 'Cognitive Load',
    codes: codes('CL_ECL_', 3),
    reverse: [],
    better: -1
  }, {
    name: 'Legacy IPQ General',
    instrument: 'Legacy IPQ',
    codes: ['IPQ_G1'],
    reverse: [],
    better: 1
  }, {
    name: 'Legacy IPQ Spatial',
    instrument: 'Legacy IPQ',
    codes: codes('IPQ_SP', 5),
    reverse: [],
    better: 1
  }, {
    name: 'Legacy IPQ Involvement',
    instrument: 'Legacy IPQ',
    codes: codes('IPQ_INV', 4),
    reverse: [],
    better: 1
  }, {
    name: 'Legacy IPQ Realism',
    instrument: 'Legacy IPQ',
    codes: codes('IPQ_REAL', 4),
    reverse: [],
    better: 1
  }];
}
