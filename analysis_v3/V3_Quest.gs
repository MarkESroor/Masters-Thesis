/* Session/phase metrics. Cumulative mode_totals are audit-only. */
function v3Spatial_(points) {
  const valid = points.filter(function(p) {
    return p.x !== '' && p.z !== '';
  });
  if (!valid.length) return {
    spatial_spread: '',
    route_length: ''
  };
  const xs = valid.map(function(p) {
      return p.x;
    }),
    zs = valid.map(function(p) {
      return p.z;
    });
  let route = 0;
  for (let i = 1; i < valid.length; i++) route += Math.hypot(valid[i].x - valid[i - 1].x, valid[i].z - valid[
    i - 1].z);
  return {
    spatial_spread: Math.hypot(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, zs) -
      Math.min.apply(null, zs)),
    route_length: valid.length > 1 ? route : ''
  };
}

function v3LayoutGeometry_(data) {
  const walls = data.walls || data.edges || data.wallSegments;
  if (!Array.isArray(walls)) return {
    wall_count: '',
    wall_length: '',
    layout_complexity: '',
    layout_units: 'Unsupported schema'
  };
  const endpoints = new Map();
  let length = 0;
  let invalid = false;
  walls.forEach(function(w) {
    const a = w.A || w.start || w.from,
      b = w.B || w.end || w.to;
    if (!a || !b) {
      invalid = true;
      return;
    }
    const ax = v3Number_(a.x),
      az = v3Number_(a.z === undefined ? a.y : a.z),
      bx = v3Number_(b.x),
      bz = v3Number_(b.z === undefined ? b.y : b.z);
    if ([ax, az, bx, bz].includes('')) {
      invalid = true;
      return;
    }
    length += Math.hypot(ax - bx, az - bz);
    [JSON.stringify([ax, az]), JSON.stringify([bx, bz])].forEach(function(k) {
      endpoints.set(k, (endpoints.get(k) || 0) + 1);
    });
  });
  return {
    wall_count: walls.length,
    wall_length: invalid ? '' : length,
    layout_complexity: invalid ? '' : Array.from(endpoints.values()).filter(function(n) {
      return n !== 2;
    }).length,
    layout_units: data.edges ? 'grid steps (not world meters)' : 'source coordinate units'
  };
}

function v3LayoutEntries_(files, issues) {
  const out = [];
  files.filter(function(f) {
    return f.kind === 'layout' && f.data && !f.error;
  }).forEach(function(f) {
    if (Array.isArray(f.data.layouts)) {
      f.data.layouts.forEach(function(l) {
        try {
          out.push({
            file: f,
            name: l.Name,
            data: JSON.parse(l.Json)
          });
        } catch (e) {
          v3Issue_(issues, 'Warning', 'layout_json', f.id, '', 'Invalid embedded layout JSON');
        }
      });
    } else out.push({
      file: f,
      name: f.name.replace(/_(grid|loci|furniture)\.json$/i, '').replace(/\.json$/i, ''),
      data: f.data
    });
  });
  return out;
}

function v3QuestKind_(name) {
  const m = name.match(/(?:^|_)(mode_durations|mode_totals|selection_choices|loci_placements|events)\.csv$/i);
  return m ? m[1] : '';
}

function v3BuildQuest_(files, state, issues) {
  const rows = [],
    groups = Object.create(null),
    layouts = v3LayoutEntries_(files, issues);
  files.filter(function(f) {
    return f.kind === 'quest' && !f.error;
  }).forEach(function(f) {
    const metadata = f.data && /metadata/i.test(f.name) ? f.data : null;
    const rs = f.parsed ? f.parsed.rows : metadata ? [metadata] : [];
    rs.forEach(function(r) {
      const session = v3Text_(v3Get_(r, ['session_id'])) || ((f.path || '').match(
        /(?:session|final)_(\d{8}_\d{6}_[a-z0-9]+)/i) || [])[1] || f.parent_id || '';
      if (!session) {
        v3Issue_(issues, 'Warning', 'quest_session_missing', f.id, '',
        'Quest file has no session ID');
        return;
      }
      const g = groups[session] = groups[session] || {
        metadata: [],
        events: [],
        files: []
      };
      if (!g.files.some(function(x) {
          return x.id === f.id;
        })) g.files.push(f);
      if (metadata) g.metadata.push({
        data: r,
        file: f
      });
      else g.events.push({
        row: r,
        file: f,
        type: v3QuestKind_(f.name)
      });
    });
  });
  Object.keys(groups).sort().forEach(function(session) {
    const g = groups[session];
    const validMetadata = g.metadata.filter(function(m) {
      const fd = v3ChooseDecision_(m.file.id, '', state.fileDecisions);
      return !fd.error && v3Boolean_(fd.include) !== false;
    });
    const metadata = validMetadata.length === 1 ? validMetadata[0].data : {};
    if (g.metadata.length > 1) v3Issue_(issues, 'Warning', 'duplicate_session_metadata', session, '',
      'Multiple session metadata files; metadata fallback disabled');
    const eligible = g.events.filter(function(e) {
      const fd = v3ChooseDecision_(e.file.id, '', state.fileDecisions);
      if (fd.error || (v3Text_(fd.include) && v3Boolean_(fd.include) === '')) {
        throw new Error('Invalid or conflicting Quest file decision: ' + e.file.id);
      }
      return v3Boolean_(fd.include) !== false;
    });
    const phases = v3Group_(eligible.filter(function(e) {
      return e.type && e.type !== 'mode_totals';
    }), function(e) {
      return v3Text_(v3Get_(e.row, ['condition_code', 'condition'])) || v3Text_(metadata.condition);
    });
    Object.keys(phases).sort().forEach(function(raw) {
      const events = phases[raw].slice().sort(function(a, b) {
        return v3Text_(v3Get_(a.row, ['timestamp_iso'])).localeCompare(v3Text_(v3Get_(b.row, [
          'timestamp_iso'
        ]))) || a.row.__row_number - b.row.__row_number;
      });
      const first = events[0];
      const baseRow = Object.assign({}, first.row, {
        session_id: session
      });
      if (!v3Get_(baseRow, ['participant_id'])) baseRow.participant_id = metadata.participant_id ||
      '';
      const recordId = v3Id_(['quest', session, raw]);
      const r = v3Metadata_(baseRow, Object.assign({}, first.file, {
        session_id: session
      }), recordId, state, issues, 'quest');
      r.source_file_ids = v3Unique_(events.map(function(e) {
        return e.file.id;
      })).join('|');
      r.source_hashes = v3Unique_(events.map(function(e) {
        return e.file.hash;
      })).join('|');
      const ids = v3Unique_(events.map(function(e) {
        return v3NormalizeText_(v3Get_(e.row, ['participant_id']));
      }).filter(Boolean));
      if (ids.length > 1) {
        r.status = 'Invalid';
        r.reason = 'Conflicting participant IDs within session phase';
        v3Issue_(issues, 'Error', 'quest_identity', recordId, r.participant_id, r.reason);
      }
      const byType = v3Group_(events, function(e) {
        return e.type;
      });
      Object.keys(byType).forEach(function(type) {
        if (v3Unique_(byType[type].map(function(e) {
            return e.file.id;
          })).length > 1) {
          r.status = 'Duplicate';
          r.reason = 'Duplicate Quest files for phase/type ' + type;
          v3Issue_(issues, 'Error', 'quest_duplicate', recordId, r.participant_id, r.reason);
        }
      });
      const durations = events.filter(function(e) {
        return e.type === 'mode_durations';
      });
      const mode = {};
      durations.forEach(function(e) {
        const n = v3Number_(v3Get_(e.row, ['duration_seconds'])),
          name = v3Text_(v3Get_(e.row, ['mode_name']));
        if (n !== '' && n >= 0 && name) mode[name] = (mode[name] || 0) + n;
      });
      r.setup_seconds = Object.prototype.hasOwnProperty.call(mode, 'WallBuilding') ? mode
        .WallBuilding : '';
      r.furniture_seconds = Object.prototype.hasOwnProperty.call(mode, 'Furniture') ? mode.Furniture :
        '';
      r.loci_mode_seconds = Object.prototype.hasOwnProperty.call(mode, 'LociPlacement') ? mode
        .LociPlacement : '';
      r.mode_seconds_json = JSON.stringify(mode);
      r.timing_note =
        'Only mode_durations summed; cumulative mode_totals excluded. Phase labels at mode end may cross transitions.';
      const choices = events.filter(function(e) {
        return e.type === 'selection_choices';
      });
      const finals = new Map();
      let decision = 0, decisionCount = 0;
      const distribution = {};
      choices.forEach(function(e) {
        const n = v3Number_(v3Get_(e.row, ['decision_duration_seconds']));
        if (n !== '' && n >= 0) { decision += n; decisionCount++; }
        const locus = v3Text_(v3Get_(e.row, ['loci_index']));
        const word = v3Text_(v3Get_(e.row, ['word']));
        const image = v3Text_(v3Get_(e.row, ['selected_image']));
        if (locus) finals.set(locus, {
          loci_index: locus,
          word: word,
          image: image,
          choice_index: v3Get_(e.row, ['choice_index'])
        });
        if (image) distribution[image] = (distribution[image] || 0) + 1;
      });
      r.image_selection_seconds = choices.length && decisionCount === choices.length ? decision : '';
      r.changed_image_selections = choices.length && choices.every(function(e) { return v3Boolean_(v3Get_(e.row, ['changed_selection'])) !== ''; }) ? choices.filter(function(e) {
        return v3Boolean_(v3Get_(e.row, ['changed_selection'])) === true;
      }).length : '';
      r.image_choice_events = choices.length || '';
      r.image_choice_distribution = JSON.stringify(distribution);
      r.final_image_choices_json = JSON.stringify(Array.from(finals.values()).sort(function(a, b) {
        return Number(a.loci_index) - Number(b.loci_index);
      }));
      const loci = events.filter(function(e) {
        return e.type === 'loci_placements';
      });
      const points = new Map();
      let placement = 0,
        moves = 0,
        deletions = 0;
      const lastPlacement = new Map();
      loci.forEach(function(e) {
        const action = v3Key_(v3Get_(e.row, ['action'])),
          idx = v3Text_(v3Get_(e.row, ['loci_index']));
        if (!idx) return;
        if (action === 'deleted') {
          points.delete(idx);
          deletions++;
        } else if (['confirmed', 'placed', 'moved'].includes(action)) {
          const p = {
            x: v3Number_(v3Get_(e.row, ['position_x'])),
            z: v3Number_(v3Get_(e.row, ['position_z']))
          };
          points.set(idx, p);
          if (action === 'moved') moves++;
          else {
            const n = v3Number_(v3Get_(e.row, ['placement_duration_seconds']));
            const prev = lastPlacement.get(idx);
            if (n !== '' && n >= 0) {
              if (action === 'placed' && prev && prev.action === 'confirmed') placement -= prev.n;
              placement += n;
              lastPlacement.set(idx, {
                action: action,
                n: n
              });
            }
          }
        }
      });
      r.final_loci_count = loci.length ? points.size : '';
      r.loci_placement_seconds = lastPlacement.size ? placement : '';
      r.loci_moves = loci.length ? moves : '';
      r.loci_deletions = loci.length ? deletions : '';
      Object.assign(r, v3Spatial_(Array.from(points.keys()).sort(function(a, b) {
        return Number(a) - Number(b);
      }).map(function(k) {
        return points.get(k);
      })));
      r.layout_status = 'Unlinked';
      const requested = r.layout_file_id;
      const candidates = layouts.filter(function(l) {
        return requested ? l.file.id === requested : metadata.layout_name && l.name === metadata
          .layout_name;
      });
      const geometry = candidates.filter(function(l) {
        return Array.isArray(l.data.edges) || Array.isArray(l.data.walls) || Array.isArray(l.data
          .wallSegments);
      });
      if (geometry.length === 1) {
        Object.assign(r, v3LayoutGeometry_(geometry[0].data));
        r.layout_file_id = geometry[0].file.id;
        r.layout_source_hash = geometry[0].file.hash;
        r.layout_status = requested ? 'Explicit file link' : 'Exact metadata layout name';
      } else if (geometry.length > 1) {
        r.layout_status = 'Ambiguous';
        v3Issue_(issues, 'Warning', 'layout_ambiguous', recordId, r.participant_id,
          'Multiple exact grid layouts; none selected', 'Set layout_file_id in Session Overrides.');
      }
      r.raw_events_json = JSON.stringify(events.map(function(e) {
        return {
          file_id: e.file.id,
          row: e.row,
          type: e.type
        };
      }));
      rows.push(r);
    });
    const totals = eligible.filter(function(e) {
      return e.type === 'mode_totals';
    });
    if (totals.length) v3Issue_(issues, 'Info', 'cumulative_totals_audit', session, '', totals.length +
      ' cumulative rows retained in source; excluded from condition timings.',
      'See source IDs in Import Audit.');
  });
  v3RejectDuplicates_(rows, issues, 'quest');
  return rows;
}
