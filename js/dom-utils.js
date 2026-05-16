// =============================================================================
// dom-utils.js – Lightweight DOM patching to avoid full innerHTML re-renders
// =============================================================================
// Preserves scroll position and avoids re-creating unchanged nodes.
// Strategy: parse new HTML into a DocumentFragment, then reconcile top-level
// children with the existing DOM using a keyed (data-card, id) or positional diff.
// =============================================================================

/**
 * Patch a container's content with new HTML, minimizing DOM mutations.
 * - Preserves scroll position of the container and its scrollable parents.
 * - Reuses existing DOM nodes when possible (matched by key or tag+position).
 * - Falls back to full replace for structurally very different content.
 *
 * @param {HTMLElement} container - The target container element
 * @param {string} newHtml - The new HTML string to render
 * @param {object} [options] - Options
 * @param {Function} [options.onAfterPatch] - Callback after patching (for rebinding events)
 */
export function patchDOM(container, newHtml, options = {}) {
  if (!container) return;

  // Save scroll positions
  const scrollState = saveScrollState(container);

  // Parse new HTML into a temporary container
  const template = document.createElement("template");
  template.innerHTML = newHtml;
  const newNodes = template.content;

  // If container is empty or the structure is radically different, just replace
  if (!container.hasChildNodes() || shouldFullReplace(container, newNodes)) {
    container.innerHTML = newHtml;
    restoreScrollState(container, scrollState);
    if (options.onAfterPatch) options.onAfterPatch();
    return;
  }

  // Reconcile children
  reconcileChildren(container, newNodes);

  // Restore scroll
  restoreScrollState(container, scrollState);

  if (options.onAfterPatch) options.onAfterPatch();
}

/**
 * Decides if we should skip diffing and just do a full replace.
 * If the number of top-level element children differs by more than 50%, full replace.
 */
function shouldFullReplace(existing, newFragment) {
  const oldCount = existing.children.length;
  const newCount = countElements(newFragment);
  if (oldCount === 0 || newCount === 0) return true;
  const ratio = Math.abs(oldCount - newCount) / Math.max(oldCount, newCount);
  return ratio > 0.5;
}

function countElements(fragment) {
  let count = 0;
  for (const node of fragment.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) count++;
  }
  return count;
}

/**
 * Reconcile the children of `parent` to match `newFragment`.
 * Uses keys (data-card, id) for matching, falls back to positional matching.
 */
function reconcileChildren(parent, newFragment) {
  const oldChildren = Array.from(parent.childNodes);
  const newChildren = Array.from(newFragment.childNodes);

  const oldKeyed = buildKeyMap(oldChildren);
  let oldIndex = 0;

  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const newKey = getNodeKey(newChild);

    // Try to find a matching old node
    let matchedOld = null;

    if (newKey && oldKeyed.has(newKey)) {
      matchedOld = oldKeyed.get(newKey);
      oldKeyed.delete(newKey);
    } else if (oldIndex < oldChildren.length) {
      // Positional match: same tag and no key conflict
      const candidate = oldChildren[oldIndex];
      if (candidate && nodesAreSameType(candidate, newChild) && !getNodeKey(candidate)) {
        matchedOld = candidate;
      }
      oldIndex++;
    }

    if (matchedOld) {
      // Update the existing node in place
      patchNode(matchedOld, newChild);
      // Ensure correct position
      if (parent.childNodes[i] !== matchedOld) {
        parent.insertBefore(matchedOld, parent.childNodes[i] || null);
      }
    } else {
      // Insert new node
      const refNode = parent.childNodes[i] || null;
      parent.insertBefore(newChild.cloneNode(true), refNode);
    }
  }

  // Remove excess old nodes
  while (parent.childNodes.length > newChildren.length) {
    parent.removeChild(parent.lastChild);
  }
}

/**
 * Patch an individual node: update attributes, classes, and content.
 */
function patchNode(oldNode, newNode) {
  // Text nodes: just update content
  if (oldNode.nodeType === Node.TEXT_NODE && newNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newNode.textContent) {
      oldNode.textContent = newNode.textContent;
    }
    return;
  }

  // Comment nodes
  if (oldNode.nodeType === Node.COMMENT_NODE && newNode.nodeType === Node.COMMENT_NODE) {
    if (oldNode.textContent !== newNode.textContent) {
      oldNode.textContent = newNode.textContent;
    }
    return;
  }

  // Different node types: replace entirely
  if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
    oldNode.parentNode.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Element nodes: update attributes then recurse on children
  if (oldNode.nodeType === Node.ELEMENT_NODE) {
    updateAttributes(oldNode, newNode);

    // For leaf elements with simple text content, fast-path
    if (isLeafElement(oldNode) && isLeafElement(newNode)) {
      if (oldNode.innerHTML !== newNode.innerHTML) {
        oldNode.innerHTML = newNode.innerHTML;
      }
      return;
    }

    // Recurse on children
    reconcileChildren(oldNode, newNode);
  }
}

/**
 * A leaf element has no child elements (only text/inline content).
 * We use innerHTML comparison for these for speed.
 */
function isLeafElement(el) {
  return el.children.length === 0;
}

/**
 * Sync attributes from newEl to oldEl.
 */
function updateAttributes(oldEl, newEl) {
  // Remove old attributes not in new
  const oldAttrs = Array.from(oldEl.attributes);
  for (const attr of oldAttrs) {
    if (!newEl.hasAttribute(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  }
  // Set/update new attributes
  const newAttrs = Array.from(newEl.attributes);
  for (const attr of newAttrs) {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }
}

/**
 * Check if two nodes are the same type (same tag name for elements).
 */
function nodesAreSameType(a, b) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName;
}

/**
 * Get a stable key for a node (from data-card, id, or data-key attributes).
 */
function getNodeKey(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  return node.getAttribute("data-card") || node.getAttribute("id") || node.getAttribute("data-key") || null;
}

/**
 * Build a map of keyed nodes.
 */
function buildKeyMap(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const key = getNodeKey(node);
    if (key) map.set(key, node);
  }
  return map;
}

/**
 * Save scroll positions of the container and scrollable ancestors.
 */
function saveScrollState(container) {
  const state = {
    self: { top: container.scrollTop, left: container.scrollLeft },
    tableScrolls: []
  };
  // Save scroll of any .table-scroll elements inside
  container.querySelectorAll(".table-scroll").forEach(el => {
    state.tableScrolls.push({ el, left: el.scrollLeft, top: el.scrollTop });
  });
  // Save window scroll
  state.window = { top: window.scrollY, left: window.scrollX };
  return state;
}

/**
 * Restore scroll positions.
 */
function restoreScrollState(container, scrollState) {
  container.scrollTop = scrollState.self.top;
  container.scrollLeft = scrollState.self.left;
  window.scrollTo(scrollState.window.left, scrollState.window.top);
  // Restore table scrolls by class matching
  if (scrollState.tableScrolls.length) {
    const newScrollables = container.querySelectorAll(".table-scroll");
    scrollState.tableScrolls.forEach((saved, i) => {
      if (newScrollables[i]) {
        newScrollables[i].scrollLeft = saved.left;
        newScrollables[i].scrollTop = saved.top;
      }
    });
  }
}
