export const CONSENT_TREE_ATTRIBUTE = 'data-consent-tree';
export const CONSENT_OWNER_ATTRIBUTE = 'data-consent-owner';
export const CONSENT_WORKSPACE_ATTRIBUTE = 'data-consent-workspace';
export const CONSENT_PROJECT_ATTRIBUTE = 'data-consent-project';
export const CONSENT_GROUP_ATTRIBUTE = 'data-consent-group';
export const CONSENT_PROJECTS_ATTRIBUTE = 'data-consent-projects';
export const CONSENT_TOGGLE_ATTRIBUTE = 'data-consent-toggle';
export const CONSENT_SELECT_ALL_ATTRIBUTE = 'data-consent-select-all';
export const CONSENT_SELECT_ALL_ROW_ATTRIBUTE = 'data-consent-select-all-row';
export const CONSENT_SUMMARY_ATTRIBUTE = 'data-consent-summary';
export const CONSENT_WORKSPACE_ID_ATTRIBUTE = 'data-workspace-id';
export const CONSENT_SHOW_LABEL_ATTRIBUTE = 'data-show-label';
export const CONSENT_HIDE_LABEL_ATTRIBUTE = 'data-hide-label';
export const CONSENT_WORDS_ATTRIBUTE = 'data-words';
export const CONSENT_COUNT_SLOT = '{{count}}';
export const CONSENT_WORKSPACES_SLOT = '{{workspaces}}';
export const CONSENT_PROJECTS_SLOT = '{{projects}}';

export const CONSENT_SCRIPT = `{
  const tree = document.querySelector('[${CONSENT_TREE_ATTRIBUTE}]');
  if (tree !== null) {
    const form = tree.closest('form');
    const ownerBox = form.querySelector('[${CONSENT_OWNER_ATTRIBUTE}]');
    const selectAll = form.querySelector('[${CONSENT_SELECT_ALL_ATTRIBUTE}]');
    const summary = form.querySelector('[${CONSENT_SUMMARY_ATTRIBUTE}]');
    const workspaceBoxes = [...tree.querySelectorAll('[${CONSENT_WORKSPACE_ATTRIBUTE}]')];
    const projectBoxes = [...tree.querySelectorAll('[${CONSENT_PROJECT_ATTRIBUTE}]')];
    const words = JSON.parse(summary.getAttribute('${CONSENT_WORDS_ATTRIBUTE}'));
    const countOf = (one, many, count) => (count === 1 ? one : many).replace('${CONSENT_COUNT_SLOT}', String(count));
    const projectsOf = (workspaceBox) =>
      projectBoxes.filter((projectBox) => projectBox.getAttribute('${CONSENT_WORKSPACE_ID_ATTRIBUTE}') === workspaceBox.getAttribute('${CONSENT_WORKSPACE_ID_ATTRIBUTE}'));
    const setWorkspace = (workspaceBox, isChecked) => {
      workspaceBox.checked = isChecked;
      projectsOf(workspaceBox).forEach((projectBox) => {
        projectBox.checked = isChecked;
        projectBox.disabled = isChecked;
      });
    };
    const clearSelection = () => {
      workspaceBoxes.forEach((workspaceBox) => setWorkspace(workspaceBox, false));
      projectBoxes.forEach((projectBox) => {
        projectBox.checked = false;
      });
    };
    const summaryText = () => {
      const workspaces = workspaceBoxes.filter((box) => box.checked).length;
      const projects = projectBoxes.filter((box) => box.checked && !box.disabled).length;
      if (ownerBox !== null && ownerBox.checked) return words.account;
      if (workspaces === 0 && projects === 0) return words.none;
      const workspaceText = countOf(words.workspaceOne, words.workspaceMany, workspaces);
      const projectText = countOf(words.projectOne, words.projectMany, projects);
      if (projects === 0) return workspaceText;
      if (workspaces === 0) return projectText;
      return words.both.replace('${CONSENT_WORKSPACES_SLOT}', workspaceText).replace('${CONSENT_PROJECTS_SLOT}', projectText);
    };
    const refresh = () => {
      selectAll.checked = workspaceBoxes.length > 0 && workspaceBoxes.every((box) => box.checked);
      summary.textContent = summaryText();
    };
    form.addEventListener('change', (event) => {
      const box = event.target;
      if (box === ownerBox && ownerBox.checked) clearSelection();
      if (box === selectAll) workspaceBoxes.forEach((workspaceBox) => setWorkspace(workspaceBox, selectAll.checked));
      if (workspaceBoxes.includes(box)) setWorkspace(box, box.checked);
      const isSelectionTick = box !== ownerBox && box.checked;
      if (isSelectionTick && ownerBox !== null) ownerBox.checked = false;
      refresh();
    });
    tree.querySelectorAll('[${CONSENT_GROUP_ATTRIBUTE}]').forEach((group) => {
      const toggle = group.querySelector('[${CONSENT_TOGGLE_ATTRIBUTE}]');
      const projects = group.querySelector('[${CONSENT_PROJECTS_ATTRIBUTE}]');
      const show = (isOpen) => {
        projects.hidden = !isOpen;
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.textContent = toggle.getAttribute(isOpen ? '${CONSENT_HIDE_LABEL_ATTRIBUTE}' : '${CONSENT_SHOW_LABEL_ATTRIBUTE}');
      };
      toggle.hidden = false;
      toggle.addEventListener('click', () => show(projects.hidden));
      show(false);
    });
    form.querySelector('[${CONSENT_SELECT_ALL_ROW_ATTRIBUTE}]').hidden = false;
    summary.hidden = false;
    refresh();
  }
}`;
