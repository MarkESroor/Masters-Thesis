"""Check the thesis's frozen recall summary against its pseudonymous trial rows."""
import json
import math
import statistics
from pathlib import Path

snapshot = json.loads((Path(__file__).parent / 'data/results_snapshot_2026-09-22.json').read_text(encoding='utf-8'))
summaries = {row[0]: dict(zip(snapshot['headers'], row)) for row in snapshot['rows']}
for timepoint in ('Immediate', 'Delayed24h', 'Delayed1Week'):
    pairs = {}
    for trial in snapshot['recall_trials']:
        if trial['status'] == 'Include' and trial['timepoint'] == timepoint:
            assert math.isclose(trial['accuracy'], trial['correct'] / trial['targets'], abs_tol=1e-8)
            key = (trial['participant'], trial['list_set'])
            pair = pairs.setdefault(key, {})
            assert trial['condition'] not in pair, 'Duplicate eligible condition'
            pair[trial['condition']] = trial['accuracy']
    complete = [p for p in pairs.values() if set(p) == {'Generic', 'Personalized'}]
    summary = summaries[timepoint + ' — Recall accuracy']
    assert len(complete) == int(summary['paired_n'])
    differences = [p['Personalized'] - p['Generic'] for p in complete]
    mean = statistics.mean(differences)
    sd = statistics.stdev(differences)
    calculated = {
        'generic_mean': statistics.mean(p['Generic'] for p in complete),
        'personalized_mean': statistics.mean(p['Personalized'] for p in complete),
        'mean_difference': mean,
        'paired_t': mean / (sd / math.sqrt(len(complete))),
        'cohens_dz': mean / sd,
    }
    for field, value in calculated.items():
        assert math.isclose(value, float(summary[field]), abs_tol=1e-8), (timepoint, field)
    print(f'{timepoint}: {len(complete)} pairs; means, difference, t and dz verified')
print('This checks arithmetic only; source data-quality blockers remain unresolved.')
