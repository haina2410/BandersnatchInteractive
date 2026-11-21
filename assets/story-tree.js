// The story is a graph. Segment groups describe all possible destinations
// for a transition whose actual destination depends on the viewer's choices.
function getStoryGroupTargets(groupId, ancestors = []) {
	if (ancestors.includes(groupId))
		return [];
	const groups = [...ancestors, groupId];
	return (segmentGroups[groupId] || []).flatMap(entry => {
		if (entry.segmentGroup)
			return getStoryGroupTargets(entry.segmentGroup, groups);
		return entry.segment || entry;
	});
}

function getStoryBranches(segmentId) {
	const branches = [];
	const targetsOf = ids => [...new Set(ids.filter(id => Object.hasOwn(segmentMap.segments, id)))];
	const seenTargets = new Set();
	for (const moment of momentsBySegment[segmentId] || []) {
		for (const [index, choice] of (moment.choices || []).entries()) {
			const targets = targetsOf(choice.sg ? getStoryGroupTargets(choice.sg) : [choice.segmentId]);
			if (!targets.length)
				continue;
			const label = choice.text || (moment.type === 'scene:cs_bs_phone'
				? (choice.code ? 'Correct number' : 'Other number') : 'Choice ' + (index + 1));
			branches.push({ label, targets });
			targets.forEach(id => seenTargets.add(id));
		}
	}

	const continuation = targetsOf([segmentMap.segments[segmentId].defaultNext, ...getStoryGroupTargets(segmentId)])
		.filter(id => !seenTargets.has(id));
	if (continuation.length)
		branches.push({ label: 'Continue', targets: continuation });
	return branches;
}

function getStoryPath(branches, currentId, preferredPath) {
	const root = segmentMap.initialSegment;
	const preferredIndex = preferredPath.indexOf(currentId);
	if (preferredIndex >= 0)
		return preferredPath.slice(0, preferredIndex + 1);

	// Find a route from the start even for a stage opened from a shared link.
	const routes = new Map([[root, [root]]]);
	for (const [id, path] of routes) {
		for (const { targets } of branches[id]) {
			for (const target of targets) {
				if (!routes.has(target))
					routes.set(target, [...path, target]);
			}
		}
	}

	// Follow recorded transitions where they can be joined to the root without a loop.
	let path = routes.get(currentId) || [root];
	const suffix = [currentId];
	for (let id = currentId; id && id !== root; id = suffix[0]) {
		const previous = ls['breadcrumb_' + id];
		const index = preferredPath.indexOf(previous);
		const prefix = index >= 0 ? preferredPath.slice(0, index + 1) : routes.get(previous);
		if (!prefix || prefix.some(stage => suffix.includes(stage))
			|| !branches[previous].some(branch => branch.targets.includes(id)))
			break;
		path = [...prefix, ...suffix];
		suffix.unshift(previous);
	}
	return path;
}

function storyStageTitle(id) {
	const namedMoment = momentsBySegment[id]?.find(moment => moment.choices && choicePoints[moment.id]?.description);
	const description = choicePoints[id]?.description || choicePoints[namedMoment?.id]?.description;
	if (description)
		return description;
	if (segmentMap.segments[id].credits)
		return 'Credits';
	if (segmentMap.segments[id].storyEnd)
		return 'Ending';
	return 'Scene ' + id;
}

function layoutStoryTree(branches, currentPath) {
	const root = segmentMap.initialSegment;
	const pathParents = new Map(currentPath.slice(1).map((id, index) => [id, currentPath[index]]));
	const placed = new Set([root]);
	const levels = [[{ id: root, path: [root] }]];

	// Give each stage one position. Shared destinations and loops can be reached
	// through shortcut nodes without repeating the same subtree.
	for (const [depth, level] of levels.entries()) {
		const next = [];
		for (const [row, parent] of level.entries()) {
			if (parent.shortcut)
				continue;
			for (const { label, targets } of branches[parent.id]) {
				const children = targets.filter(id => !placed.has(id)
					&& (!pathParents.has(id) || pathParents.get(id) === parent.id));
				for (const id of children) {
					placed.add(id);
					next.push({ id, label, parentRow: row, path: [...parent.path, id] });
				}
				if (!children.length) {
					const id = targets[0];
					const ancestorIndex = parent.path.indexOf(id);
					const path = ancestorIndex >= 0 ? parent.path.slice(0, ancestorIndex + 1) : [...parent.path, id];
					next.push({ id, label, parentRow: row, path, shortcut: ancestorIndex >= 0 ? 'Loops back' : 'Shared stage' });
				}
			}
		}
		if (next.length)
			levels[depth + 1] = next;
	}
	return levels;
}

function renderStoryTree(container, currentId, preferredPath, onSelect) {
	const branches = Object.fromEntries(Object.keys(segmentMap.segments).map(id => [id, getStoryBranches(id)]));
	const currentPath = getStoryPath(branches, currentId, preferredPath);
	const levels = layoutStoryTree(branches, currentPath);
	const seen = getSeenScenes();
	const map = document.createElement('div');
	map.className = 'story-map';
	map.style.setProperty('--story-columns', levels.length);
	map.style.setProperty('--story-rows', Math.max(...levels.map(level => level.length)));

	function element(tag, className, label) {
		const node = document.createElement(tag);
		node.className = className;
		if (label)
			node.textContent = label;
		return node;
	}

	for (const [column, level] of levels.entries()) {
		for (const [row, { id, label, parentRow, path, shortcut }] of level.entries()) {
			const onPath = !shortcut && currentPath[column] === id;
			if (column > 0) {
				const line = element('span', 'story-connection');
				line.toggleAttribute('data-on-path', Boolean(onPath));
				line.style.setProperty('--column', column - 1);
				line.style.setProperty('--row', parentRow);
				line.style.setProperty('--rise', row - parentRow);
				map.append(line);
			}

			const stage = element('button', 'story-stage');
			stage.type = 'button';
			stage.style.setProperty('--column', column);
			stage.style.setProperty('--row', row);
			if (column === 0)
				stage.dataset.root = '';
			if (onPath && id === currentId)
				stage.setAttribute('aria-current', 'location');
			stage.append(element('span', 'story-stage-choice', label || 'Start'));
			const title = storyStageTitle(id);
			stage.append(element('span', 'story-stage-title', title));
			stage.title = [...new Set([label, title, 'Scene ' + id].filter(Boolean))].join(' · ');
			const status = shortcut || (seen.has(id) && id !== currentId ? 'Seen' : '');
			if (status)
				stage.append(element('span', 'story-stage-status', status));
			stage.addEventListener('click', () => onSelect(path));
			map.append(stage);
		}
	}
	container.replaceChildren(map);
}
