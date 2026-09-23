/* Participant-condition correlations. Missing values stay missing and are never zero-filled. */
function v3Pearson_(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min((x || []).length, (y || []).length); i++) {
    const left = v3Number_(x[i]), right = v3Number_(y[i]);
    if (left !== '' && right !== '') pairs.push([left, right]);
  }
  if (pairs.length < 2) return '';
  const xm = v3Mean_(pairs.map(function(p) { return p[0]; }));
  const ym = v3Mean_(pairs.map(function(p) { return p[1]; }));
  let cross = 0, leftSquares = 0, rightSquares = 0;
  pairs.forEach(function(p) {
    const left = p[0] - xm, right = p[1] - ym;
    cross += left * right;
    leftSquares += left * left;
    rightSquares += right * right;
  });
  return leftSquares && rightSquares ? cross / Math.sqrt(leftSquares * rightSquares) : '';
}

function v3CorrelationLabel_(source, field) {
  return source + ' | ' + String(field).replace(/_/g, ' ');
}

function v3CorrelationAggregate_(entries) {
  const groups = {};
  (entries || []).forEach(function(entry) {
    const participant = v3Text_(entry.participant_id), condition = v3Text_(entry.palace_condition), numeric =
      v3Number_(entry.value);
    if (!participant || !['Generic', 'Personalized'].includes(condition) || numeric === '') return;
    const variable = v3CorrelationLabel_(entry.source, entry.field), key = JSON.stringify([participant, condition,
      variable
    ]);
    if (!groups[key]) groups[key] = {
      participant_id: participant,
      palace_condition: condition,
      variable: variable,
      values: []
    };
    groups[key].values.push(numeric);
  });
  return Object.keys(groups).map(function(key) {
    const group = groups[key];
    return {
      participant_id: group.participant_id,
      palace_condition: group.palace_condition,
      variable: group.variable,
      value: v3Mean_(group.values),
      observations: group.values.length
    };
  }).sort(function(left, right) {
    return left.variable.localeCompare(right.variable) || left.participant_id.localeCompare(right.participant_id) ||
      left.palace_condition.localeCompare(right.palace_condition);
  });
}

function v3CorrelationValues_(result) {
  const entries = [];
  const add = function(row, source, field, value) {
    entries.push({
      participant_id: row.participant_id,
      palace_condition: row.palace_condition,
      source: source,
      field: field,
      value: value
    });
  };
  result.trials.filter(function(row) { return row.status === 'Include'; }).forEach(function(row) {
    Object.keys(row.metrics || {}).forEach(function(field) {
      add(row, 'Recall | ' + row.timepoint, field, row.metrics[field]);
    });
    ['recall_duration_seconds', 'actual_delay_hours'].forEach(function(field) {
      add(row, 'Recall | ' + row.timepoint, field, row[field]);
    });
  });
  result.questions.filter(function(row) { return row.status === 'Include'; }).forEach(function(row) {
    add(row, 'Questionnaire', row.metric, row.value);
  });
  result.quest.filter(function(row) { return row.status === 'Include'; }).forEach(function(row) {
    Object.keys(row).forEach(function(field) {
      if (field !== 'participant_id' && field !== 'palace_condition') add(row, 'Quest', field, row[field]);
    });
  });
  return v3CorrelationAggregate_(entries);
}

function v3CorrelationValuesFromOutputs_() {
  const entries = [];
  const add = function(row, source, field, value) {
    entries.push({
      participant_id: row.participant_id,
      palace_condition: row.palace_condition,
      source: source,
      field: field,
      value: value
    });
  };
  v3ReadTable_('Recall Trials').filter(function(row) { return row.status === 'Include'; }).forEach(function(row) {
    const source = 'Recall | ' + (v3Text_(row.timepoint) || 'Unknown timepoint');
    Object.keys(row).forEach(function(field) { add(row, source, field, row[field]); });
  });
  v3ReadTable_('Questionnaire Scores').filter(function(row) { return row.status === 'Include'; }).forEach(
    function(row) { add(row, 'Questionnaire', row.metric, row.value); });
  v3ReadTable_('Quest Metrics').filter(function(row) {
    return row.row_type === 'Summary' && row.status === 'Include';
  }).forEach(function(row) {
    Object.keys(row).forEach(function(field) { add(row, 'Quest', field, row[field]); });
  });
  return v3CorrelationAggregate_(entries);
}

function v3CorrelationPairs_(rows, xVariable, yVariable) {
  const cells = {};
  rows.forEach(function(row) {
    const key = JSON.stringify([row.participant_id, row.palace_condition]);
    if (!cells[key]) cells[key] = {
      participant_id: row.participant_id,
      palace_condition: row.palace_condition
    };
    const value = v3Number_(row.value);
    if (row.variable === xVariable) cells[key].x = value;
    if (row.variable === yVariable) cells[key].y = value;
  });
  return Object.keys(cells).map(function(key) { return cells[key]; }).filter(function(row) {
    return row.x !== undefined && row.x !== '' && row.y !== undefined && row.y !== '';
  });
}

function v3WriteVariableComparison_(rows, activate) {
  const sheet = v3Sheet_('Variable Comparison');
  if (!v3GeneratedNames_().includes('Variable Comparison')) throw new Error('Unknown generated sheet');
  const variables = v3Unique_(rows.map(function(row) { return row.variable; })).sort();
  const previousX = v3Text_(sheet.getRange(2, 2).getValue());
  const previousY = v3Text_(sheet.getRange(3, 2).getValue());
  const xVariable = variables.includes(previousX) ? previousX : variables[0] || '';
  const yVariable = variables.includes(previousY) && previousY !== xVariable ? previousY : variables.find(
    function(variable) { return variable !== xVariable; }) || '';
  const pairs = v3CorrelationPairs_(rows, xVariable, yVariable);
  const conditionPairs = [{
    label: 'Generic',
    data: pairs.filter(function(row) { return row.palace_condition === 'Generic'; }),
    sourceColumn: 1,
    chartColumn: 6,
    color: '#2878B5'
  }, {
    label: 'Personalized',
    data: pairs.filter(function(row) { return row.palace_condition === 'Personalized'; }),
    sourceColumn: 4,
    chartColumn: 14,
    color: '#C27637'
  }];
  const x = pairs.map(function(row) { return row.x; });
  const y = pairs.map(function(row) { return row.y; });
  const pearson = v3Pearson_(x, y);
  const spearman = v3Spearman_(x, y);
  const pearsonP = pearson === '' || pairs.length < 3 ? '' : Math.abs(pearson) === 1 ? 0 :
    v3StudentTTwoSidedP_(pearson * Math.sqrt((pairs.length - 2) / (1 - pearson * pearson)), pairs.length - 2);
  sheet.getCharts().forEach(function(chart) { sheet.removeChart(chart); });
  sheet.clear();
  const helperRow = pairs.length + 14;
  const largestCondition = Math.max.apply(null, conditionPairs.map(function(spec) { return spec.data.length; }));
  v3Size_(sheet, Math.max(14, helperRow + largestCondition), 14);
  sheet.getRange(1, 1, 1, 4).setValues([['V3 Variable Comparison', '', '', '']]);
  sheet.getRange(2, 1, 2, 2).setValues([['Variable X', xVariable], ['Variable Y', yVariable]]);
  sheet.getRange(5, 1, 5, 2).setValues([
    ['Matched participant-condition pairs', pairs.length],
    ['Pearson r', pearson],
    ['Pearson two-sided p', pearsonP],
    ['Spearman rho', spearman],
    ['Interpretation', 'Exact participant-condition matches only; missing values are excluded, not zero-filled.']
  ]);
  sheet.getRange(11, 1, 1, 4).setValues([['participant_id', 'palace_condition', xVariable || 'Variable X',
    yVariable || 'Variable Y'
  ]]);
  if (pairs.length) sheet.getRange(12, 1, pairs.length, 4).setValues(pairs.map(function(row) {
    return [row.participant_id, row.palace_condition, row.x, row.y];
  }));
  conditionPairs.forEach(function(spec) {
    sheet.getRange(helperRow, spec.sourceColumn, 1, 2).setValues([[xVariable || 'Variable X', yVariable ||
      'Variable Y'
    ]]);
    if (spec.data.length) sheet.getRange(helperRow + 1, spec.sourceColumn, spec.data.length, 2).setValues(spec.data
      .map(function(row) { return [row.x, row.y]; }));
  });
  if (variables.length) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(variables, true).setAllowInvalid(false).build();
    sheet.getRange(2, 2, 2, 1).setDataValidation(rule);
  }
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, 1, 4).setBackground('#183B4E').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange(11, 1, 1, 4).setBackground('#183B4E').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setColumnWidths(1, 2, 180);
  sheet.setColumnWidths(3, 2, 260);
  conditionPairs.forEach(function(spec) {
    if (spec.data.length < 2) return;
    const chart = sheet.newChart().setChartType(Charts.ChartType.SCATTER).addRange(sheet.getRange(helperRow,
      spec.sourceColumn, spec.data.length + 1, 2)).setNumHeaders(1).setPosition(1, spec.chartColumn, 0, 0).setOption(
      'title', spec.label + ': ' + xVariable + ' vs ' + yVariable).setOption('hAxis', { title: xVariable }).setOption(
      'vAxis', { title: yVariable }).setOption('legend', { position: 'none' }).setOption('pointSize', 6).setOption(
      'trendlines', {
        0: { type: 'linear', color: spec.color, lineWidth: 2, opacity: 0.7, showR2: true, visibleInLegend: true }
      }).build();
    sheet.insertChart(chart);
  });
  if (activate) {
    sheet.showSheet();
    SpreadsheetApp.getActive().setActiveSheet(sheet);
  }
  return {
    pearson: pearson,
    pairs: pairs.length,
    x_variable: xVariable,
    y_variable: yVariable
  };
}

function v3WriteCorrelationOutputs_(result) {
  const rows = v3CorrelationValues_(result);
  v3WriteGenerated_('Variable Data', rows, ['participant_id', 'palace_condition', 'variable', 'value',
    'observations'
  ]);
  return v3WriteVariableComparison_(rows, false);
}

function v3CompareTwoVariables(activate) {
  return v3Locked_(function() {
    if (activate !== false) v3InstallMenu();
    let rows = v3ReadTable_('Variable Data');
    if (!rows.length) {
      rows = v3CorrelationValuesFromOutputs_();
      if (!rows.length) throw new Error('No V3 output data is available to compare');
      v3WriteGenerated_('Variable Data', rows, ['participant_id', 'palace_condition', 'variable', 'value',
        'observations'
      ]);
    }
    const result = v3WriteVariableComparison_(rows, activate !== false);
    if (activate !== false) SpreadsheetApp.getActive().toast(result.pairs + ' matched pairs; Pearson r=' +
      (result.pearson === '' ? 'unavailable' : result.pearson.toFixed(3)), 'VR Experiment V3', 8);
    return result;
  });
}

function v3OnEdit(e) {
  const range = e && e.range;
  if (!range || range.getSheet().getName() !== 'V3 Variable Comparison') return;
  if (range.getColumn() === 2 && [2, 3].includes(range.getRow())) v3CompareTwoVariables(false);
}
