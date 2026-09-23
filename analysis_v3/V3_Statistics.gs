/* Participant is the inferential unit. Missing values and duplicate cells never become zeros. */
function v3TCritical_(df) {
  if (df < 1) return '';
  let lo = 0,
    hi = 100;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (v3StudentTTwoSidedP_(mid, df) > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function v3NormalCdf_(z) {
  const x = Math.abs(z) / Math.sqrt(2),
    t = 1 / (1 + 0.3275911 * x);
  const erf = (z < 0 ? -1 : 1) * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
    0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  return (1 + erf) / 2;
}

function v3Wilcoxon_(differences) {
  const clean = differences.filter(function(d) {
    return typeof d === 'number' && isFinite(d);
  });
  const nz = clean.filter(function(d) {
    return Math.abs(d) > 1e-12;
  });
  if (!clean.length) return {
    w: '',
    p: '',
    n_nonzero: 0,
    method: 'No pairs'
  };
  if (!nz.length) return {
    w: 0,
    p: 1,
    n_nonzero: 0,
    method: 'All differences zero'
  };
  const ranks = v3Rank_(nz.map(function(d) {
    return Math.round(Math.abs(d) * 1e12) / 1e12;
  }));
  const total = ranks.reduce(function(s, n) {
      return s + n;
    }, 0),
    pos = ranks.reduce(function(s, n, i) {
      return s + (nz[i] > 0 ? n : 0);
    }, 0),
    w = Math.min(pos, total - pos);
  if (nz.length <= 50) {
    const scaled = ranks.map(function(r) {
      return r * 2;
    });
    let probs = [1];
    scaled.forEach(function(rank) {
      const next = Array(probs.length + rank).fill(0);
      probs.forEach(function(p, i) {
        next[i] += p / 2;
        next[i + rank] += p / 2;
      });
      probs = next;
    });
    return {
      w: w,
      p: Math.min(1, 2 * probs.slice(0, Math.round(w * 2) + 1).reduce(function(s, p) {
        return s + p;
      }, 0)),
      n_nonzero: nz.length,
      method: 'Exact conditional sign permutation; tied midranks; zero differences omitted only here'
    };
  }
  const variance = ranks.reduce(function(s, r) {
    return s + r * r;
  }, 0) / 4;
  const z = Math.max(0, Math.abs(pos - total / 2) - 0.5) / Math.sqrt(variance);
  return {
    w: w,
    p: Math.min(1, 2 * (1 - v3NormalCdf_(z))),
    n_nonzero: nz.length,
    method: 'Normal approximation; tied-rank variance and continuity correction'
  };
}

function v3Pairs_(records, value, expected) {
  const eligible = records.filter(function(r) {
    return r.status === 'Include' && r.participant_id && ['Generic', 'Personalized'].includes(r
      .palace_condition);
  });
  const cells = v3Group_(eligible, function(r) {
    return JSON.stringify([r.participant_id, r.palace_condition]);
  });
  const participants = v3Unique_((expected || []).concat(eligible.map(function(r) {
    return r.participant_id;
  }))).sort();
  const pairs = [];
  participants.forEach(function(id) {
    const get = function(c) {
      const a = cells[JSON.stringify([id, c])] || [];
      return a.length === 1 ? v3Number_(value(a[0])) : '';
    };
    const g = get('Generic'),
      p = get('Personalized');
    if (g !== '' && p !== '') pairs.push({
      participant_id: id,
      generic: g,
      personalized: p,
      difference: p - g
    });
  });
  return {
    pairs: pairs,
    missing_pairs: participants.length - pairs.length,
    expected_n: participants.length
  };
}

function v3PeriodPairs_(records, value, expected) {
  const eligible = records.filter(function(r) {
    return r.status === 'Include' && r.participant_id && [1, 2].includes(v3Number_(r.period));
  });
  const cells = v3Group_(eligible, function(r) {
    return JSON.stringify([r.participant_id, v3Number_(r.period)]);
  });
  const participants = v3Unique_((expected || []).concat(eligible.map(function(r) {
    return r.participant_id;
  }))).sort();
  const pairs = [];
  participants.forEach(function(id) {
    const get = function(period) {
      const a = cells[JSON.stringify([id, period])] || [];
      return a.length === 1 ? v3Number_(value(a[0])) : '';
    };
    const first = get(1),
      second = get(2);
    if (first !== '' && second !== '') pairs.push({
      participant_id: id,
      first: first,
      second: second,
      difference: second - first
    });
  });
  return {
    pairs: pairs,
    missing_pairs: participants.length - pairs.length,
    expected_n: participants.length
  };
}

function v3PairSummary_(pairData, metric, role, better, cfg, infer) {
  const pairs = pairData.pairs,
    d = pairs.map(function(p) {
      return p.difference;
    }),
    g = pairs.map(function(p) {
      return p.generic;
    }),
    p = pairs.map(function(p) {
      return p.personalized;
    });
  const t = v3PairedTTest_(d),
    w = v3Wilcoxon_(d),
    sd = v3SampleStandardDeviation_(d),
    mean = v3Mean_(d);
  const margin = d.length > 1 ? v3TCritical_(d.length - 1) * sd / Math.sqrt(d.length) : '';
  const direction = mean === '' ? 'Unavailable' : mean > 1e-12 ? 'Personalized higher' : mean < -1e-12 ?
    'Generic higher' : 'Tie';
  const favor = better === 0 ? direction : mean === '' ? 'Unavailable' : Math.abs(mean) < 1e-12 ? 'Tie' :
    mean * better > 0 ? 'Personalized' : 'Generic';
  let interpretation = !d.length ? 'No complete pairs.' : direction + ' by ' + mean.toFixed(3) + '; ' + d
    .length + ' paired participants.';
  if (d.length < cfg.tiny_sample_n) interpretation += ' Small sample; inference is unstable.';
  if (t.p !== '' && t.p >= 0.05) interpretation += ' This does not establish equivalence or no effect.';
  if (sd === 0) interpretation += ' Zero variance: t-test and dz are undefined.';
  if (infer === false) interpretation += ' Descriptive only; below the configured subgroup minimum.';
  return {
    metric: metric,
    role: role,
    paired_n: d.length,
    generic_mean: v3Mean_(g),
    generic_sd: v3SampleStandardDeviation_(g),
    personalized_mean: v3Mean_(p),
    personalized_sd: v3SampleStandardDeviation_(p),
    mean_difference: mean,
    median_difference: v3Median_(d),
    ci95_low: infer === false || margin === '' ? '' : mean - margin,
    ci95_high: infer === false || margin === '' ? '' : mean + margin,
    paired_t: infer === false ? '' : t.t,
    df: infer === false ? '' : t.df,
    p: infer === false ? '' : t.p,
    cohens_dz: infer === false ? '' : t.cohens_dz,
    wilcoxon_w: infer === false ? '' : w.w,
    wilcoxon_p: infer === false ? '' : w.p,
    wilcoxon_method: infer === false ? 'Descriptive only' : w.method,
    personalized_wins: d.filter(function(x) {
      return x > 1e-12;
    }).length,
    generic_wins: d.filter(function(x) {
      return x < -1e-12;
    }).length,
    ties: d.filter(function(x) {
      return Math.abs(x) <= 1e-12;
    }).length,
    missing_pairs: pairData.missing_pairs,
    direction: direction,
    favors: favor,
    interpretation: interpretation,
    warning: 'Paired complete cases; inspect list, list set, period, order and missingness. Observational subgroup patterns are not causal.',
    q: '',
    family: role === 'Exploratory' ? 'Exploratory outcomes' : '',
    pairs: pairs
  };
}

function v3PeriodPairSummary_(pairData, metric, better, cfg) {
  const translated = {
    pairs: pairData.pairs.map(function(p) {
      return {
        participant_id: p.participant_id,
        generic: p.first,
        personalized: p.second,
        difference: p.difference
      };
    }),
    missing_pairs: pairData.missing_pairs,
    expected_n: pairData.expected_n
  };
  const base = v3PairSummary_(translated, metric, 'Exploratory session-order diagnostic', better, cfg,
    true);
  const differences = pairData.pairs.map(function(p) {
    return p.difference;
  });
  const secondBetter = differences.filter(function(d) {
    return d * better > 1e-12;
  }).length;
  const firstBetter = differences.filter(function(d) {
    return d * better < -1e-12;
  }).length;
  const ties = differences.length - secondBetter - firstBetter;
  const direction = base.mean_difference === '' ? 'Unavailable' : Math.abs(base.mean_difference) <=
    1e-12 ? 'Tie' : base.mean_difference * better > 0 ? 'Second session better' :
    'First session better';
  const allImprovementsSecond = !differences.length ? 'No complete pairs' : firstBetter ? 'No' :
    secondBetter ? 'Yes' : 'No paired differences';
  return {
    metric: metric,
    role: base.role,
    paired_n: base.paired_n,
    first_mean: base.generic_mean,
    first_sd: base.generic_sd,
    second_mean: base.personalized_mean,
    second_sd: base.personalized_sd,
    mean_difference: base.mean_difference,
    median_difference: base.median_difference,
    ci95_low: base.ci95_low,
    ci95_high: base.ci95_high,
    paired_t: base.paired_t,
    df: base.df,
    p: base.p,
    cohens_dz: base.cohens_dz,
    wilcoxon_w: base.wilcoxon_w,
    wilcoxon_p: base.wilcoxon_p,
    wilcoxon_method: base.wilcoxon_method,
    second_better: secondBetter,
    first_better: firstBetter,
    ties: ties,
    all_improvements_second: allImprovementsSecond,
    missing_pairs: base.missing_pairs,
    direction: direction,
    interpretation: !differences.length ? 'No complete Period 1/Period 2 pairs.' : direction +
      ' by ' + Math.abs(base.mean_difference).toFixed(3) + '; ' + secondBetter +
      ' participants better second, ' + firstBetter + ' better first, ' + ties + ' tied.',
    warning: 'Descriptive session-order check. Period is confounded with palace condition and word list; it cannot establish a practice effect.',
    pairs: pairData.pairs
  };
}

function v3ExpectedParticipants_(state) {
  return state.registry.filter(function(r) {
    return v3Boolean_(r.inclusion_exclusion) === true;
  }).map(function(r) {
    return r.canonical_participant_id;
  });
}

function v3RecallMetrics_() {
  return [
    ['Recall accuracy', 'proportion_correct', 1],
    ['Recall quantity', 'correct_unique', 1],
    ['Order accuracy (LCS/list length)', 'lcs_proportion', 1],
    ['Kendall recalled order', 'kendall', 1],
    ['Recall duration (seconds)', 'recall_duration_seconds', -1],
    ['Retention change from Immediate', 'retention_change', 1]
  ];
}

function v3BuildStatistics_(trials, questions, quest, state) {
  const results = [],
    expected = v3ExpectedParticipants_(state),
    cfg = state.cfg;
  cfg.timepoints.forEach(function(tp) {
    if (!tp.required && !trials.some(function(t) {
        return t.timepoint === tp.id;
      })) return;
    const selected = trials.filter(function(t) {
      return t.timepoint === tp.id;
    });
    v3RecallMetrics_().forEach(function(m) {
      if (tp.id === 'Immediate' && m[1] === 'retention_change') return;
      const data = v3Pairs_(selected, function(t) {
        return t.metrics[m[1]] === undefined ? t[m[1]] : t.metrics[m[1]];
      }, expected);
      const role = m[1] === 'proportion_correct' && tp.id === 'Immediate' ? 'Predeclared primary' : m[
          1] === 'proportion_correct' && tp.id === 'Delayed24h' ? 'Predeclared primary follow-up' :
        'Secondary';
      const r = v3PairSummary_(data, tp.id + ' — ' + m[0], role, m[2], cfg, true);
      r.timepoint = tp.id;
      r.field = m[1];
      results.push(r);
    });
  });
  v3QuestionMetrics_().forEach(function(d) {
    const rs = questions.filter(function(r) {
      return r.metric === d.name;
    });
    results.push(v3PairSummary_(v3Pairs_(rs, function(r) {
      return r.value;
    }, expected), d.name, d.role || 'Secondary', d.better, cfg, true));
  });
  return results;
}

function v3BuildSessionOrderStatistics_(trials, state) {
  const results = [],
    expected = v3ExpectedParticipants_(state),
    cfg = state.cfg;
  cfg.timepoints.forEach(function(tp) {
    const selected = trials.filter(function(t) {
      return t.timepoint === tp.id;
    });
    if (!selected.length) return;
    v3RecallMetrics_().forEach(function(m) {
      if (tp.id === 'Immediate' && m[1] === 'retention_change') return;
      const data = v3PeriodPairs_(selected, function(t) {
        return t.metrics[m[1]] === undefined ? t[m[1]] : t.metrics[m[1]];
      }, expected);
      const r = v3PeriodPairSummary_(data, tp.id + ' — ' + m[0], m[2], cfg);
      r.timepoint = tp.id;
      r.field = m[1];
      results.push(r);
    });
  });
  return results;
}

function v3BH_(rows) {
  const families = v3Group_(rows.filter(function(r) {
    return r.role === 'Exploratory' && typeof r.p === 'number' && isFinite(r.p);
  }), function(r) {
    return r.family || 'Exploratory';
  });
  Object.keys(families).forEach(function(k) {
    const a = families[k].sort(function(x, y) {
      return x.p - y.p;
    });
    if (a.length < 2) return;
    let q = 1;
    for (let i = a.length - 1; i >= 0; i--) {
      q = Math.min(q, a[i].p * a.length / (i + 1));
      a[i].q = q;
    }
  });
  return rows;
}

function v3ItemRows_(trials, quest, questions, cfg) {
  const out = [];
  trials.forEach(function(t) {
    const q = quest.filter(function(r) {
      return r.status === 'Include' && r.participant_id === t.participant_id && r.palace_condition ===
        t.palace_condition && (!t.session_id || r.session_id === t.session_id);
    });
    const qrow = q.length === 1 ? q[0] : {};
    const qs = questions.filter(function(r) {
      return r.status === 'Include' && r.participant_id === t.participant_id && r.palace_condition ===
        t.palace_condition;
    });
    t.target_words.forEach(function(w, i) {
      const matches = t.audit.filter(function(a) {
        return a.target_index === i + 1;
      });
      const props = t.target_items[i] ? t.target_items[i].properties : {};
      const p = v3Number_(v3Get_(props, ['pRecall']));
      const band = p === '' ? 'Unknown' : p <= cfg.precall_cuts[0] ? 'Low' : p >= cfg.precall_cuts[
        1] ? 'High' : 'Medium';
      const r = {
        trial_id: t.record_id,
        participant_id: t.participant_id,
        palace_condition: t.palace_condition,
        condition_code: t.condition_code,
        list_id: t.list_id,
        word_list_set: t.word_list_set,
        word_source_key: t.word_source_key,
        timepoint: t.timepoint,
        target_word: w,
        serial_position: i + 1,
        relative_serial_position: (i + 1) / t.target_words.length,
        serial_band: (i + 1) / t.target_words.length <= 1 / 3 ? 'Early' : (i + 1) / t.target_words
          .length <= 2 / 3 ? 'Middle' : 'Late',
        recalled_binary: t.status === 'Include' ? (matches.length ? 1 : 0) : '',
        first_response_position: matches.length ? matches[0].response_position : '',
        response_count: matches.length,
        match_provenance: v3Unique_(matches.map(function(a) {
          return a.match_method;
        })).join('|'),
        manual_review_status: v3Unique_(matches.map(function(a) {
          return a.manual_review_status;
        })).join('|'),
        pRecall: p,
        precall_band: band,
        word_properties_json: JSON.stringify(props),
        file_id: t.file_id,
        source_hash: t.source_hash,
        target_file_id: t.target_file_id,
        target_source_hash: t.target_source_hash,
        status: t.status,
        reason: t.reason,
        period: t.period,
        condition_order: t.condition_order,
        counterbalance_group: t.counterbalance_group,
        prior_vr_experience: t.prior_vr_experience,
        recall_duration_seconds: t.recall_duration_seconds
      };
      ['AoA', 'concreteness', 'frequency', 'animacy', 'arousal', 'valence', 'dominance',
        'graspability', 'pantomime', 'action', 'danger', 'usefulness'
      ].forEach(function(k) {
        r[k] = v3Number_(v3Get_(props, k === 'frequency' ? ['frequency', 'WFlog'] : [k]));
      });
      ['setup_seconds', 'furniture_seconds', 'loci_mode_seconds', 'loci_placement_seconds',
        'image_selection_seconds', 'changed_image_selections', 'wall_count', 'wall_length',
        'layout_complexity', 'layout_units', 'route_length', 'spatial_spread', 'session_id',
        'final_image_choices_json', 'source_file_ids'
      ].forEach(function(k) {
        r['quest_' + k] = qrow[k] === undefined ? '' : qrow[k];
      });
      qs.forEach(function(s) {
        r['questionnaire_' + s.metric] = s.value;
      });
      out.push(r);
    });
  });
  return out;
}

function v3BandRecords_(items, field, value, tp) {
  const groups = v3Group_(items.filter(function(r) {
    return r.status === 'Include' && r[field] === value && r.timepoint === tp;
  }), function(r) {
    return JSON.stringify([r.participant_id, r.palace_condition]);
  });
  return Object.keys(groups).map(function(k) {
    const a = groups[k];
    return Object.assign({}, a[0], {
      value: v3Mean_(a.map(function(r) {
        return r.recalled_binary;
      })),
      status: 'Include'
    });
  });
}

function v3Interesting_(stats, trials, questions, quest, items, state, issues) {
  const cfg = state.cfg,
    findings = stats.map(function(r) {
      return Object.assign({}, r);
    });
  if (!cfg.exploratory_enabled) return v3BH_(findings);
  const all = v3ExpectedParticipants_(state);
  const registry = new Map(state.registry.map(function(r) {
    return [r.canonical_participant_id, r];
  }));
  const fields = ['prior_vr_experience', 'condition_order', 'counterbalance_group', 'word_list_set'];
  cfg.timepoints.forEach(function(tp) {
    const ts = trials.filter(function(t) {
      return t.timepoint === tp.id && t.status === 'Include';
    });
    if (!ts.length) return;
    fields.forEach(function(field) {
      const vals = v3Unique_(ts.map(function(t) {
        return t[field];
      })).filter(function(v) {
        return v !== '' && v !== undefined && v !== 'Unknown';
      });
      vals.forEach(function(v) {
        const rs = ts.filter(function(t) {
          return t[field] === v;
        });
        const data = v3Pairs_(rs, function(t) {
          return t.metrics.proportion_correct;
        });
        const f = v3PairSummary_(data, tp.id + ' recall | ' + field + '=' + v, 'Exploratory', 1,
          cfg, data.pairs.length >= cfg.min_subgroup_n);
        f.family = 'Recall subgroups';
        findings.push(f);
      });
    });
    ['precall_band', 'serial_band'].forEach(function(field) {
      v3Unique_(items.map(function(r) {
        return r[field];
      })).filter(function(v) {
        return v && v !== 'Unknown';
      }).forEach(function(v) {
        const rs = v3BandRecords_(items, field, v, tp.id),
          data = v3Pairs_(rs, function(r) {
            return r.value;
          });
        if (!data.pairs.length) return;
        const f = v3PairSummary_(data, tp.id + ' recall | ' + field + '=' + v, 'Exploratory', 1,
          cfg, data.pairs.length >= cfg.min_subgroup_n);
        f.family = 'Item-band outcomes';
        f.warning +=
          ' Participant condition means are compared; different words may populate each band.';
        findings.push(f);
      });
    });
    ['List1', 'List2'].forEach(function(list) {
      const rs = ts.filter(function(t) {
        return t.list_id === list;
      });
      if (!rs.length) return;
      const g = rs.filter(function(t) {
          return t.palace_condition === 'Generic';
        }),
        p = rs.filter(function(t) {
          return t.palace_condition === 'Personalized';
        });
      const gm = v3Mean_(g.map(function(t) {
          return t.metrics.proportion_correct;
        })),
        pm = v3Mean_(p.map(function(t) {
          return t.metrics.proportion_correct;
        }));
      findings.push({
        metric: tp.id + ' within ' + list,
        role: 'Exploratory descriptive',
        direction: gm === '' || pm === '' ? 'Unavailable' : pm > gm ? 'Personalized higher' : pm <
          gm ? 'Generic higher' : 'Tie',
        generic_mean: gm,
        personalized_mean: pm,
        mean_difference: gm === '' || pm === '' ? '' : pm - gm,
        paired_n: '',
        sample_n: rs.length,
        uncertainty: 'Descriptive means only; unmatched groups, no paired confidence interval.',
        p: '',
        q: '',
        interpretation: 'Separate condition descriptives; not a within-participant comparison.',
        warning: 'List and counterbalance are coupled. Do not infer a list moderator from separate means.'
      });
    });
    const recallPairs = v3Pairs_(ts, function(t) {
      return t.metrics.proportion_correct;
    }).pairs;
    ['setup_seconds', 'furniture_seconds', 'loci_mode_seconds', 'loci_placement_seconds',
      'image_selection_seconds', 'changed_image_selections', 'layout_complexity', 'route_length',
      'spatial_spread', 'image_choice_events', 'recall_duration_seconds'
    ].forEach(function(field) {
      const qp = v3Pairs_(field === 'recall_duration_seconds' ? ts : quest, function(r) {
        return r[field];
      }).pairs;
      const joined = recallPairs.map(function(r) {
        const q = qp.find(function(x) {
          return x.participant_id === r.participant_id;
        });
        return q ? {
          x: q.difference,
          y: r.difference
        } : null;
      }).filter(Boolean);
      if (!joined.length) return;
      const rho = v3Spearman_(joined.map(function(x) {
        return x.x;
      }), joined.map(function(x) {
        return x.y;
      }));
      const infer = joined.length >= cfg.min_association_n;
      const p = infer && rho !== '' && Math.abs(rho) < 1 ? v3StudentTTwoSidedP_(rho * Math.sqrt((
        joined.length - 2) / (1 - rho * rho)), joined.length - 2) : '';
      findings.push({
        metric: tp.id + ' recall difference vs ' + field + ' difference',
        role: 'Exploratory',
        family: 'Behavior associations',
        paired_n: joined.length,
        effect_estimate: rho,
        uncertainty: 'No correlation CI estimated; consult N and the approximate p-value. Small or tied samples can be unstable.',
        direction: rho === '' ? 'Unavailable' : rho >= 0 ? 'Positive association' :
          'Negative association',
        p: p,
        q: '',
        interpretation: infer ?
          'Spearman association of within-participant differences; approximate t p-value.' :
          'Descriptive Spearman association; inferential minimum not met.',
        warning: 'Association is non-causal; timing, list, order and practice may confound it.'
      });
    });
  });
  v3QuestionMetrics_().filter(function(d) {
    return ['IMI Interest/Enjoyment', 'IMI Perceived Competence', 'SUS Presence'].includes(d.name);
  }).forEach(function(d) {
    [true, false].forEach(function(v) {
      const rs = questions.filter(function(r) {
        const pr = registry.get(r.participant_id);
        return r.metric === d.name && pr && v3Boolean_(pr.prior_vr_experience) === v;
      });
      const data = v3Pairs_(rs, function(r) {
        return r.value;
      });
      if (data.pairs.length) {
        const f = v3PairSummary_(data, d.name + ' | prior VR=' + v, 'Exploratory', d.better, cfg, data
          .pairs.length >= cfg.min_subgroup_n);
        f.family = 'Experience subgroups';
        findings.push(f);
      }
    });
  });
  issues.filter(function(i) {
    return i.severity !== 'Info';
  }).forEach(function(i) {
    findings.push({
      metric: i.code,
      role: 'Data-quality/confounding warning',
      direction: 'Review',
      interpretation: i.detail,
      warning: i.action,
      p: '',
      q: ''
    });
  });
  v3BH_(findings);
  return findings.sort(function(a, b) {
    const rank = function(r) {
      return /^Predeclared/.test(r.role) ? 0 : r.role === 'Secondary' ? 1 : r.role ===
        'Data-quality/confounding warning' ? 3 : 2;
    };
    return rank(a) - rank(b) || (b.paired_n || 0) - (a.paired_n || 0) || Math.abs(b.cohens_dz || 0) - Math
      .abs(a.cohens_dz || 0) || Math.abs(b.effect_estimate || 0) - Math.abs(a.effect_estimate || 0);
  });
}
