/* Real embedded Sheets charts with adjacent helper tables and no duplicate charts. */
function v3ChartSpecs_(result, cfg) {
  const specs = [];
  const stat = function(name) {
    return result.stats.find(function(s) {
      return s.metric === name;
    });
  };
  const slope = function(name, title) {
    const s = stat(name),
      pairs = s ? s.pairs : [];
    specs.push({
      title: title + ' (paired N=' + pairs.length + ')',
      type: 'LINE',
      paired_n: pairs.length,
      interpretation: s ? s.interpretation : 'No paired data available.',
      table: [
        ['Palace'].concat(pairs.map(function(p) {
          return p.participant_id;
        })), ['Generic'].concat(pairs.map(function(p) {
          return p.generic;
        })), ['Personalized'].concat(pairs.map(function(p) {
          return p.personalized;
        }))
      ],
      slope: true,
      available: !!pairs.length
    });
  };
  cfg.timepoints.forEach(function(tp) {
    slope(tp.id + ' — Recall accuracy', tp.id + ' recall accuracy');
  });
  ['IMI Interest/Enjoyment', 'IMI Perceived Competence', 'SUS Presence'].forEach(function(n) {
    slope(n, n);
  });
  const retention = [
    ['Timepoint', 'Generic', 'Personalized', 'Paired N']
  ];
  cfg.timepoints.forEach(function(tp) {
    const s = stat(tp.id + ' — Recall accuracy');
    retention.push([tp.id, s ? s.generic_mean : '', s ? s.personalized_mean : '', s ? s.paired_n : 0]);
  });
  specs.push({
    title: 'Recall trajectory by condition',
    type: 'LINE',
    table: retention,
    data_columns: 3,
    interpretation: 'Each timepoint uses its complete pairs; paired N is listed. Cohort composition can change over time.',
    available: retention.slice(1).some(function(r) {
      return r[3] > 0;
    })
  });
  const quantity = [
    ['Outcome', 'Generic', 'Personalized', 'Paired N']
  ];
  cfg.timepoints.forEach(function(tp) {
    ['Recall accuracy', 'Order accuracy (LCS/list length)'].forEach(function(n) {
      const s = stat(tp.id + ' — ' + n);
      quantity.push([tp.id + ' ' + n, s ? s.generic_mean : '', s ? s.personalized_mean : '', s ? s
        .paired_n : 0
      ]);
    });
  });
  specs.push({
    title: 'Recall quantity and order proportions',
    type: 'COLUMN',
    table: quantity,
    data_columns: 3,
    interpretation: 'Recall quantity is normalized by list length. LCS also incorporates omission loss; it is not pure order among recalled words.',
    available: quantity.slice(1).some(function(r) {
      return r[3] > 0;
    })
  });
  const loads = [
    ['Load dimension', 'Generic', 'Personalized', 'Paired N']
  ];
  ['Intrinsic Cognitive Load', 'Germane Cognitive Load', 'Extraneous Cognitive Load'].forEach(function(n) {
    const s = stat(n);
    loads.push([n, s ? s.generic_mean : '', s ? s.personalized_mean : '', s ? s.paired_n : 0]);
  });
  specs.push({
    title: 'Cognitive load',
    type: 'COLUMN',
    table: loads,
    data_columns: 3,
    interpretation: 'Lower intrinsic/extraneous load and higher germane effort have different meanings; inspect each scale separately.',
    available: loads.slice(1).some(function(r) {
      return r[3] > 0;
    })
  });
  const primary = stat('Immediate — Recall accuracy');
  const diffs = [
    ['Participant', 'Personalized minus Generic']
  ].concat((primary ? primary.pairs : []).map(function(p) {
    return [p.participant_id, p.difference];
  }));
  specs.push({
    title: 'Individual immediate differences (paired N=' + (diffs.length - 1) + ')',
    type: 'BAR',
    table: diffs,
    interpretation: 'Positive favors Personalized, negative favors Generic, zero is a tie.',
    available: diffs.length > 1
  });
  ['precall_band', 'serial_band'].forEach(function(field) {
    const table = [
      [field, 'Generic', 'Personalized', 'Paired N']
    ];
    (field === 'precall_band' ? ['Low', 'Medium', 'High'] : ['Early', 'Middle', 'Late']).forEach(function(
      v) {
      const data = v3Pairs_(v3BandRecords_(result.items, field, v, 'Immediate'), function(r) {
        return r.value;
      });
      table.push([v, v3Mean_(data.pairs.map(function(p) {
        return p.generic;
      })), v3Mean_(data.pairs.map(function(p) {
        return p.personalized;
      })), data.pairs.length]);
    });
    specs.push({
      title: field === 'precall_band' ? 'Recall by pRecall band' : 'Serial-position bands',
      type: 'LINE',
      table: table,
      data_columns: 3,
      interpretation: 'Participant-level means among paired participants. Word identities and list sets can differ; descriptive only.',
      available: table.slice(1).some(function(r) {
        return r[3] > 0;
      })
    });
  });
  const curve = [
    ['Relative serial bin', 'Generic', 'Personalized', 'Paired N']
  ];
  for (let bin = 1; bin <= 10; bin++) {
    const subset = result.items.filter(function(r) {
      return r.timepoint === 'Immediate' && Math.ceil(r.relative_serial_position * 10) === bin && r
        .status === 'Include';
    });
    const groups = v3Group_(subset, function(r) {
      return JSON.stringify([r.participant_id, r.palace_condition]);
    });
    const rs = Object.keys(groups).map(function(k) {
      return Object.assign({}, groups[k][0], {
        value: v3Mean_(groups[k].map(function(r) {
          return r.recalled_binary;
        }))
      });
    });
    const data = v3Pairs_(rs, function(r) {
      return r.value;
    });
    curve.push([bin / 10, v3Mean_(data.pairs.map(function(p) {
      return p.generic;
    })), v3Mean_(data.pairs.map(function(p) {
      return p.personalized;
    })), data.pairs.length]);
  }
  specs.push({
    title: 'Serial-position recall curves',
    type: 'LINE',
    table: curve,
    data_columns: 3,
    interpretation: 'Relative list-position deciles allow different list lengths. Each point lists paired N.',
    available: curve.slice(1).some(function(r) {
      return r[3] > 0;
    })
  });
  const order = [
    ['Group / order', 'Mean Personalized minus Generic', 'Paired N']
  ];
  const byOrder = v3Group_((primary ? primary.pairs : []), function(p) {
    const t = result.trials.find(function(t) {
      return t.participant_id === p.participant_id && t.status === 'Include';
    });
    return (t ? t.counterbalance_group : 'Unknown') + ' / ' + (t && t.condition_order ? t
      .condition_order : 'Order unknown');
  });
  Object.keys(byOrder).sort().forEach(function(k) {
    order.push([k, v3Mean_(byOrder[k].map(function(p) {
      return p.difference;
    })), byOrder[k].length]);
  });
  specs.push({
    title: 'Counterbalance and condition-order diagnostic',
    type: 'COLUMN',
    table: order,
    data_columns: 2,
    interpretation: 'Descriptive paired differences; suffix group is not period or presentation order.',
    available: order.length > 1
  });
  const speed = [
    ['Duration difference (seconds)', 'Accuracy difference']
  ];
  const dur = stat('Immediate — Recall duration (seconds)');
  (primary ? primary.pairs : []).forEach(function(p) {
    const d = (dur ? dur.pairs : []).find(function(d) {
      return d.participant_id === p.participant_id;
    });
    if (d) speed.push([d.difference, p.difference]);
  });
  specs.push({
    title: 'Timed recall: speed versus accuracy (paired N=' + (speed.length - 1) + ')',
    type: 'SCATTER',
    table: speed,
    interpretation: 'Only both genuinely timed conditions. Negative duration difference means Personalized faster; positive accuracy difference means Personalized more accurate.',
    available: speed.length > 2
  });
  ['setup_seconds', 'layout_complexity'].forEach(function(field) {
    const qp = v3Pairs_(result.quest, function(q) {
      return q[field];
    }).pairs;
    const table = [
      ['Personalized minus Generic ' + field, 'Recall accuracy difference']
    ];
    (primary ? primary.pairs : []).forEach(function(p) {
      const q = qp.find(function(q) {
        return q.participant_id === p.participant_id;
      });
      if (q) table.push([q.difference, p.difference]);
    });
    specs.push({
      title: field + ' vs recall (paired N=' + (table.length - 1) + ')',
      type: 'SCATTER',
      table: table,
      interpretation: 'Within-participant differences; association is not causal. Geometry units and linkage require review.',
      available: table.length > 2
    });
  });
  return specs;
}

function v3CreateCharts_(result, cfg, step) {
  step = step || function(name, work) { return work(); };
  step('charts:clear', function() {
    const sheet = v3WriteGenerated_('Charts', [], ['V3 Charts']);
    sheet.getCharts().forEach(function(c) { sheet.removeChart(c); });
  });
  const s = v3Sheet_('Charts');
  const specs = v3ChartSpecs_(result, cfg);
  let row = 3;
  specs.forEach(function(spec, index) {
    const width = Math.max.apply(null, spec.table.map(function(r) {
      return r.length;
    }));
    const height = spec.table.length;
    step('chart:' + index, function() {
    // Retrying an interrupted chart replaces that position instead of duplicating it.
    s.getCharts().filter(function(c) { return c.getContainerInfo().getAnchorRow() === row; })
      .forEach(function(c) { s.removeChart(c); });
    v3Size_(s, row + Math.max(26, height + 5), Math.max(16, width + 9));
    s.getRange(row, 10, 1, 1).setValue(spec.title);
    s.getRange(row + 1, 10, 1, 1).setValue(spec.interpretation + (spec.available ? '' :
      ' No eligible data yet.'));
    const rectangular = spec.table.map(function(r) {
      return Array.from({
        length: width
      }, function(_, i) {
        return v3SafeCell_(r[i]);
      });
    });
    s.getRange(row + 3, 10, height, width).setValues(rectangular);
    if (spec.available) {
      const builder = s.newChart().setChartType(Charts.ChartType[spec.type]).addRange(s.getRange(row + 3,
        10, height, spec.data_columns || width)).setNumHeaders(1).setPosition(row, 1, 0, 0).setOption(
        'title', spec.title).setOption('width', 640).setOption('height', 360).setOption(
        'interpolateNulls', false).setOption('pointSize', 5).setOption('legend', {
        position: spec.slope ? 'none' : 'bottom'
      }).setOption('colors', spec.slope ? Array(width - 1).fill('#758795') : [cfg.colors.Generic, cfg
        .colors.Personalized
      ]);
      if (spec.slope) builder.setOption('hAxis', {
        title: 'Generic → Personalized'
      });
      s.insertChart(builder.build());
    }
    });
    row += Math.max(26, height + 6);
  });
  return specs;
}
