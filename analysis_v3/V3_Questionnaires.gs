/* Exact header mapping and complete-case questionnaire scoring. */
function v3MapQuestions_(headers, type, cfg) {
  const defs = v3QuestionDefinitions_().filter(function(d) {
    return d.source === 'both' || d.source === type;
  });
  const positions = cfg.questionnaire_column_positions[type] || {};
  const maps = headers.map(function(h, i) {
    const exact = defs.filter(function(d) {
      return d.aliases.includes(v3NormalizeText_(h)) || v3Key_(d.code) === v3Key_(h);
    });
    let selected = exact.length === 1 ? exact[0] : null;
    if (exact.length > 1) {
      const explicit = exact.filter(function(d) {
        return positions[d.code] === i + 1;
      });
      if (explicit.length === 1) selected = explicit[0];
    }
    return {
      index: i,
      header: h,
      code: selected ? selected.code : '',
      instrument: selected ? selected.instrument : '',
      status: selected ? 'Mapped' : exact.length ? 'Ambiguous' : 'Unmapped'
    };
  });
  const groups = v3Group_(maps.filter(function(m) {
    return m.code;
  }), function(m) {
    return m.code;
  });
  Object.keys(groups).forEach(function(k) {
    if (groups[k].length > 1) groups[k].forEach(function(m) {
      m.code = '';
      m.status = 'Ambiguous';
    });
  });
  return maps;
}

function v3ScoreScale_(raw, definition, cfg) {
  let scale = cfg.questionnaire_scales[definition.instrument];
  const values = definition.codes.map(function(c) {
    return v3Likert_(raw[c]);
  });
  if (scale === 'auto') {
    const present = values.filter(function(v) {
      return v !== '';
    });
    const signed = definition.codes.some(function(c) {
      return /^\s*[+-]\d/.test(v3Text_(raw[c]));
    }) || present.some(function(v) {
      return v <= 0;
    });
    scale = signed ? 'signed' : present.some(function(v) {
      return v > 3;
    }) ? 'seven' : '';
  }
  if (!['seven', 'signed'].includes(scale)) scale = '';
  const missing = definition.codes.filter(function(c, i) {
    const v = values[i];
    return v === '' || !Number.isInteger(v) || !scale || (scale === 'signed' ? (v < -3 || v > 3) : (v <
      1 || v > 7));
  });
  const reverse = definition.instrument === 'Legacy IPQ' ? cfg.ipq_reverse_codes : definition.reverse;
  if (definition.instrument === 'Legacy IPQ' && !cfg.ipq_keys_confirmed) return {
    value: '',
    high_count: '',
    scale: scale,
    missing: missing.join(';'),
    status: 'Review IPQ endpoint keys in Settings',
    transformed: []
  };
  if (missing.length) return {
    value: '',
    high_count: '',
    scale: scale,
    missing: missing.join(';'),
    status: scale ? 'Missing or invalid required items' : 'Ambiguous numeric scale',
    transformed: []
  };
  const normalized = values.map(function(v, i) {
    const n = scale === 'signed' ? v + 4 : v;
    return reverse.includes(definition.codes[i]) ? 8 - n : n;
  });
  return {
    value: v3Mean_(normalized),
    high_count: definition.instrument === 'SUS Presence' ? normalized.filter(function(v) {
      return v >= 6;
    }).length : '',
    scale: scale,
    missing: '',
    status: 'Complete',
    transformed: normalized
  };
}

function v3ReadQuestionSources_(cfg) {
  return [
    ['motivation', cfg.motivation_presence_url],
    ['cognitive', cfg.cognitive_load_url]
  ].filter(function(d) {
    return d[1];
  }).map(function(d) {
    const ss = SpreadsheetApp.openByUrl(d[1]);
    const sheet = ss.getSheetByName(cfg.questionnaire_tabs[d[0]]);
    if (!sheet) throw new Error('Configured response tab not found: ' + d[0]);
    const values = sheet.getDataRange().getDisplayValues();
    return {
      id: ss.getId() + ':' + sheet.getSheetId(),
      spreadsheet_id: ss.getId(),
      sheet_id: sheet.getSheetId(),
      type: d[0],
      name: ss.getName() + '/' + sheet.getName(),
      values: values,
      hash: v3Hash_(JSON.stringify(values))
    };
  });
}

function v3BuildQuestionnaires_(sources, state, issues) {
  const records = [],
    mapping = [];
  sources.forEach(function(s) {
    const maps = v3MapQuestions_(s.values[0] || [], s.type, state.cfg);
    maps.forEach(function(m) {
      mapping.push({
        source: s.id,
        column: m.index + 1,
        header: m.header,
        code: m.code,
        status: m.status
      });
      if (m.status === 'Ambiguous') v3Issue_(issues, 'Error', 'question_header', s.id, '',
        'Ambiguous header at column ' + (m.index + 1),
        'Review questionnaire_column_positions in V3 Settings.');
    });
    s.values.slice(1).forEach(function(a, i) {
      if (!a.some(function(v) {
          return v3Text_(v);
        })) return;
      const raw = {},
        meta = {};
      maps.forEach(function(m) {
        if (m.code) raw[m.code] = a[m.index];
      });
      meta.participant_id = raw.PARTICIPANT_ID;
      meta.condition = raw.CONDITION;
      const stamp = raw.TIMESTAMP || 'row ' + (i + 2);
      const rid = v3Id_(['questionnaire', s.id, raw.PARTICIPANT_ID, raw.CONDITION, stamp]);
      const file = {
        id: s.id,
        hash: s.hash,
        path: s.name
      };
      const base = v3Metadata_(meta, file, rid, state, issues, 'questionnaire');
      const observedPrior = v3Boolean_(raw.PRIOR_VR);
      if (observedPrior !== '') {
        if (base.prior_vr_experience !== '' && base.prior_vr_experience !== observedPrior) v3Issue_(
          issues, 'Warning', 'prior_vr_conflict', rid, base.participant_id,
          'Registry and questionnaire prior-VR answers differ; registry used.',
          'Verify prior VR experience in Participant Registry.');
        else base.prior_vr_experience = observedPrior;
      }
      v3QuestionMetrics_().filter(function(d) {
        return s.type === 'cognitive' ? d.instrument === 'Cognitive Load' : d.instrument !==
          'Cognitive Load';
      }).forEach(function(d) {
        if (!d.codes.some(function(c) {
            return v3Text_(raw[c]);
          })) return;
        const score = v3ScoreScale_(raw, d, state.cfg);
        const r = Object.assign({}, base, {
          metric: d.name,
          instrument: d.instrument,
          value: score.value,
          high_presence_count: score.high_count,
          scale: score.scale,
          missing_items: score.missing,
          scoring_status: score.status,
          role: d.role || 'Secondary',
          better: d.better,
          source_row: i + 2,
          source_type: s.type,
          raw_items_json: JSON.stringify(raw),
          transformed_items_json: JSON.stringify(score.transformed)
        });
        if (score.status !== 'Complete' && r.status === 'Include') {
          r.status = 'Invalid';
          r.reason = score.status;
          v3Issue_(issues, 'Warning', 'questionnaire_scoring', rid, r.participant_id, d.name +
            ': ' + score.status + (score.missing ? ' ' + score.missing : ''),
            'Review V3 Questionnaire Scores and V3 Settings.');
        }
        records.push(r);
      });
    });
  });
  v3RejectDuplicates_(records, issues, 'questionnaire');
  return {
    records: records,
    mapping: mapping
  };
}
