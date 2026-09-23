/* Pure matching: a suggestion never enters the score until a decision approves it. */
function v3TargetSignature_(words) {
  return JSON.stringify(words.map(v3NormalizeText_));
}

function v3ReviewId_(trial, position, raw) {
  return v3Id_([trial.record_id, trial.participant_id, trial.palace_condition, trial.list_id, trial
    .word_list_set, trial.target_signature, position, v3Text_(raw)
  ]);
}

function v3ActiveRules_(rules) {
  const superseded = new Set();
  rules.forEach(function(r) {
    v3Text_(r.supersedes).split('\n').filter(Boolean).forEach(function(id) {
      superseded.add(id);
    });
  });
  return rules.filter(function(r) {
    return v3Boolean_(r.active) !== false && !superseded.has(r.rule_id);
  });
}

function v3RuleFor_(item, trial, rules) {
  const active = v3ActiveRules_(rules);
  if (active.some(function(r) {
      return r.normalized_response === item.normalized_response && !v3Scopes_().includes(r.scope);
    })) return {
    conflict: true,
    rule_ids: 'Invalid rule scope'
  };
  const candidates = active.filter(function(r) {
    if (r.normalized_response !== item.normalized_response) return false;
    if (r.scope === 'This occurrence only') return r.review_id === item.review_id;
    if (r.scope === 'This participant and list') return r.participant_id === trial.participant_id && r
      .list_id === trial.list_id && r.word_list_set === trial.word_list_set && r.target_signature ===
      trial.target_signature;
    return r.scope === 'Global spelling/alias rule';
  });
  if (!candidates.length) return null;
  const rank = function(r) {
    return {
      'This occurrence only': 3,
      'This participant and list': 2,
      'Global spelling/alias rule': 1
    } [r.scope];
  };
  const best = Math.max.apply(null, candidates.map(rank));
  const top = candidates.filter(function(r) {
    return rank(r) === best;
  });
  const outcomes = v3Unique_(top.map(function(r) {
    return JSON.stringify([r.decision, v3NormalizeText_(r.target_word)]);
  }));
  if (outcomes.length > 1) return {
    conflict: true,
    rule_ids: top.map(function(r) {
      return r.rule_id;
    }).join('\n')
  };
  return top[0];
}

function v3SimplePlural_(a, b, cfg) {
  if (cfg.plural_pairs[a] === b || cfg.plural_pairs[b] === a) return true;
  const safe = function(s) {
    return s.length >= 3 && !/(s|ss|us|is|y|ch|sh|x|z)$/.test(s);
  };
  return (safe(a) && a + 's' === b) || (safe(b) && b + 's' === a);
}

function v3MatchTrial_(trial, rules, cfg) {
  const targets = trial.target_words.map(function(w, i) {
    return {
      word: w,
      key: v3NormalizeText_(w),
      position: i + 1
    };
  });
  const audit = [];
  (trial.responses || []).forEach(function(raw, i) {
    if (!v3Text_(raw)) return;
    const a = {
      review_id: v3ReviewId_(trial, i + 1, raw),
      response_position: i + 1,
      raw_response: v3Text_(raw),
      normalized_response: v3NormalizeText_(raw),
      matched_target: '',
      target_index: '',
      suggested_target: '',
      alternative_targets: '',
      match_method: 'Intrusion',
      confidence: 0,
      manual_review_status: 'Unreviewed',
      rule_id: '',
      ignored: false,
      conflict: false
    };
    const rule = v3RuleFor_(a, trial, rules);
    let selected;
    if (rule) {
      a.match_method = 'Researcher decision';
      a.rule_id = rule.rule_id || rule.rule_ids;
      a.manual_review_status = 'Reviewed';
      if (rule.conflict) {
        a.conflict = true;
        a.match_method = 'Conflicting decisions';
      } else if (rule.decision === 'incorrect') a.match_method = 'Researcher decision: incorrect';
      else if (rule.decision === 'ignore') {
        a.ignored = true;
        a.match_method = 'Researcher decision: ignore';
      } else if (rule.decision === 'correct') {
        selected = targets.find(function(t) {
          return t.key === v3NormalizeText_(rule.target_word);
        });
        if (!selected) {
          a.conflict = true;
          a.match_method = 'Decision target not in this list';
        }
      } else {
        a.conflict = true;
        a.match_method = 'Invalid decision rule';
      }
    } else {
      selected = targets.find(function(t) {
        return t.key === a.normalized_response;
      });
      if (selected) {
        a.match_method = v3Text_(raw) === selected.word ? 'Exact match' : 'Automatic safe normalization';
        a.confidence = 1;
      }
      if (!selected) {
        const plurals = targets.filter(function(t) {
          return v3SimplePlural_(a.normalized_response, t.key, cfg);
        });
        if (plurals.length === 1) {
          selected = plurals[0];
          a.match_method = 'Automatic safe normalization: singular/plural';
          a.confidence = 0.99;
        }
      }
      if (!selected && cfg.safe_aliases[a.normalized_response]) {
        selected = targets.find(function(t) {
          return t.key === v3NormalizeText_(cfg.safe_aliases[a.normalized_response]);
        });
        if (selected) {
          a.match_method = 'Documented spelling alias';
          a.confidence = 0.95;
        }
      }
      if (!selected) {
        const semantic = cfg.near_miss_aliases[a.normalized_response];
        const distances = targets.map(function(t) {
          const d = v3Levenshtein_(a.normalized_response, t.key);
          return {
            target: t,
            d: d,
            similarity: 1 - d / Math.max(1, a.normalized_response.length, t.key.length)
          };
        }).filter(function(x) {
          return x.similarity >= 0.75 && x.d <= 2;
        }).sort(function(x, y) {
          return y.similarity - x.similarity || x.target.position - y.target.position;
        });
        if (semantic && targets.some(function(t) {
            return t.key === v3NormalizeText_(semantic);
          })) {
          a.suggested_target = targets.find(function(t) {
            return t.key === v3NormalizeText_(semantic);
          }).word;
          a.match_method = 'Semantic suggestion';
          a.confidence = 0.8;
        } else if (distances.length) {
          a.suggested_target = distances[0].target.word;
          a.match_method = 'Fuzzy suggestion';
          a.confidence = distances[0].similarity;
        }
        a.alternative_targets = distances.map(function(x) {
          return x.target.word;
        }).filter(function(w) {
          return w !== a.suggested_target;
        }).slice(0, 3).join(' | ');
      }
    }
    if (selected) {
      a.matched_target = selected.word;
      a.target_index = selected.position;
      if (rule) a.confidence = 1;
      if (!rule) a.manual_review_status = 'Automatic';
    }
    audit.push(a);
  });
  return audit;
}

function v3SequenceMetrics_(audit, words) {
  const active = audit.filter(function(a) {
    return !a.ignored;
  });
  const seen = new Set();
  const unique = [];
  let repetitions = 0;
  const responseSeen = new Set();
  active.forEach(function(a) {
    const k = a.target_index !== '' ? 'target:' + a.target_index : 'raw:' + a.normalized_response;
    if (responseSeen.has(k)) repetitions++;
    responseSeen.add(k);
    if (a.target_index !== '' && !seen.has(a.target_index)) {
      seen.add(a.target_index);
      unique.push(a);
    }
  });
  const indices = unique.map(function(a) {
    return a.target_index;
  });
  const lcs = v3LcsLength_(words.map(function(_, i) {
    return i + 1;
  }), indices);
  return {
    responses_entered: audit.length,
    ignored_responses: audit.length - active.length,
    correct_unique: unique.length,
    proportion_correct: words.length ? unique.length / words.length : '',
    omissions: words.length - unique.length,
    intrusions: active.filter(function(a) {
      return a.target_index === '' && !a.suggested_target;
    }).length,
    repetitions: repetitions,
    near_misses: active.filter(function(a) {
      return a.suggested_target && a.target_index === '';
    }).length,
    exact_position_matches: unique.filter(function(a) {
      return a.response_position === a.target_index;
    }).length,
    lcs: lcs,
    lcs_proportion: words.length ? lcs / words.length : '',
    adjacent_correct_pairs: indices.slice(1).filter(function(n, i) {
      return n === indices[i] + 1;
    }).length,
    kendall: v3KendallTau_(indices),
    mean_absolute_displacement: v3Mean_(unique.map(function(a) {
      return Math.abs(a.response_position - a.target_index);
    })),
    manual_review_count: active.filter(function(a) {
      return a.manual_review_status === 'Unreviewed';
    }).length
  };
}

function v3QueueRows_(trials) {
  const out = [];
  trials.forEach(function(t) {
    (t.audit || []).forEach(function(a) {
      out.push(Object.assign({}, a, {
        participant_id: t.participant_id,
        palace_condition: t.palace_condition,
        list_id: t.list_id,
        word_list_set: t.word_list_set,
        timepoint: t.timepoint,
        trial_id: t.record_id,
        file_id: t.file_id,
        current_scoring_result: a.conflict ? 'Blocked' : a.ignored ? 'Ignored' : a
          .matched_target ? 'Counted as ' + a.matched_target : 'Not counted',
        researcher_decision: 'Unreviewed',
        replacement_target: '',
        scope: 'This occurrence only',
        notes: '',
        decision_timestamp: '',
        target_signature: t.target_signature,
        source_hash: t.source_hash,
        review_status: t.status === 'Include' ? 'Current' : 'Trial ' + t.status,
        applied_signature: ''
      }));
    });
  });
  return out;
}

function v3MergeQueue_(oldRows, newRows) {
  const fresh = new Map(newRows.map(function(r) {
    return [r.review_id, r];
  }));
  const result = oldRows.map(function(old) {
    const r = fresh.get(old.review_id);
    if (!r) return Object.assign({}, old, {
      review_status: 'Stale source occurrence; retained for audit'
    });
    fresh.delete(old.review_id);
    const merged = Object.assign({}, old, r);
    if (old.researcher_decision === 'Count as suggested target') merged.suggested_target = old
      .suggested_target;
    ['researcher_decision', 'replacement_target', 'scope', 'notes', 'decision_timestamp',
      'applied_signature'
    ].forEach(function(k) {
      merged[k] = old[k];
    });
    return merged;
  });
  fresh.forEach(function(r) {
    result.push(r);
  });
  return result;
}

function v3DecisionSignature_(r) {
  return JSON.stringify([r.researcher_decision, r.replacement_target, r.scope, r.notes, r.suggested_target, r
    .target_signature
  ]);
}

function v3CompileDecisions_(queue, rules, now) {
  const additions = [],
    updates = [];
  const active = v3ActiveRules_(rules);
  queue.forEach(function(q) {
    if (!q.researcher_decision || q.researcher_decision === 'Unreviewed') return;
    const signature = v3DecisionSignature_(q);
    if (q.applied_signature === signature) return;
    if (/^Stale/.test(q.review_status)) throw new Error(
      'Cannot apply a changed decision to stale review ' + q.review_id);
    if (!v3DecisionChoices_().includes(q.researcher_decision) || !v3Scopes_().includes(q.scope))
    throw new Error('Invalid decision/scope: ' + q.review_id);
    const target = q.researcher_decision === 'Count as suggested target' ? q.suggested_target : q
      .replacement_target;
    const correct = /^Count as (suggested|selected) target$/.test(q.researcher_decision);
    if (correct && (!target || !JSON.parse(q.target_signature).includes(v3NormalizeText_(target))))
    throw new Error('Select a target from this occurrence’s target list: ' + q.review_id);
    const previous = active.filter(function(r) {
      return r.review_id === q.review_id;
    });
    const rule = {
      rule_id: v3Id_(['decision', q.review_id, signature, rules.length + additions.length]),
      review_id: q.review_id,
      normalized_response: q.normalized_response,
      target_word: correct ? v3NormalizeText_(target) : '',
      decision: correct ? 'correct' : q.researcher_decision === 'Ignore response' ? 'ignore' :
        'incorrect',
      scope: q.scope,
      participant_id: q.participant_id,
      list_id: q.list_id,
      word_list_set: q.word_list_set,
      target_signature: q.target_signature,
      notes: q.notes,
      decision_timestamp: now,
      active: true,
      origin: 'Word Review Queue',
      supersedes: previous.map(function(r) {
        return r.rule_id;
      }).join('\n')
    };
    // Recover safely if a prior run appended the rule but timed out before its queue receipt.
    const identical = previous.find(function(r) {
      return ['normalized_response', 'target_word', 'decision', 'scope', 'participant_id',
        'list_id', 'word_list_set', 'target_signature', 'notes'].every(function(k) {
        return v3Text_(r[k]) === v3Text_(rule[k]);
      });
    });
    if (!identical) additions.push(rule);
    updates.push(Object.assign({}, q, {
      decision_timestamp: now,
      applied_signature: signature
    }));
  });
  return {
    additions: additions,
    updates: updates
  };
}
