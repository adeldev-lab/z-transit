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
let _patchDepth = 0;
const MAX_PATCH_DEPTH = 1; // Prevent re-entrant patchDOM on the same container

export function patchDOM(container, newHtml, options = {}) {
  if (!container) return;

  // Guard against re-entrant calls (e.g. event handler inside onAfterPatch
  // triggers saveSettings which triggers renderCurrentTab which calls patchDOM
  // on the same container while we're still inside the first patchDOM).
  if (container._patching) {
    // Defer to next microtask to break the synchronous loop
    queueMicrotask(() => patchDOM(container, newHtml, options));
    return;
  }
  container._patching = true;

  try {
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
  } finally {
    container._patching = false;
  }
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

  // Compute synthetic keys per child:
  //   1. Explicit key from `data-card` / `id` / `data-key`.
  //   2. Fallback class-based key (`__cls__:NODENAME.class`) ONLY when
  //      `nodeName.className` is unique among the siblings on that side.
  // Repeated-class siblings (e.g. multiple `<label class="field-row">`)
  // therefore stay on the positional path, while uniquely-classed
  // unkeyed siblings (e.g. `<span class="u0">` next to
  // `<span class="u2">`) preserve identity across reorderings (B5).
  const oldKeys = computeChildKeys(oldChildren);
  const newKeys = computeChildKeys(newChildren);

  const oldKeyed = new Map();
  for (let i = 0; i < oldChildren.length; i++) {
    if (oldKeys[i]) oldKeyed.set(oldKeys[i], oldChildren[i]);
  }

  // Mark keyed slots so the positional scan skips them — they are
  // reserved for their consumer (which may appear later in
  // `newChildren`). Without this, an old keyed slot would block the
  // unkeyed positional pointer from finding the next unkeyed candidate,
  // dropping its identity (B5).
  const consumed = new Array(oldChildren.length).fill(false);
  for (let i = 0; i < oldChildren.length; i++) {
    if (oldKeys[i]) consumed[i] = true;
  }
  let oldIndex = 0;

  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const newKey = newKeys[i];

    let matchedOld = null;

    if (newKey && oldKeyed.has(newKey)) {
      // Keyed (or class-keyed) match: do NOT advance oldIndex — the
      // positional pointer must stay aligned with the next unkeyed
      // candidate.
      matchedOld = oldKeyed.get(newKey);
      oldKeyed.delete(newKey);
    } else if (!newKey) {
      // Unkeyed new child: advance oldIndex past any consumed (keyed
      // or already-used) slots, then take the next unkeyed candidate
      // of the same nodeType/nodeName. Leaves oldIndex unchanged when
      // no compatible candidate is reachable, in which case we insert.
      while (oldIndex < oldChildren.length && consumed[oldIndex]) oldIndex++;
      if (oldIndex < oldChildren.length) {
        const candidate = oldChildren[oldIndex];
        if (candidate && nodesAreSameType(candidate, newChild) && !oldKeys[oldIndex]) {
          matchedOld = candidate;
          consumed[oldIndex] = true;
          oldIndex++;
        }
        // else: incompatible candidate → treat as insertion, leave
        // oldIndex put so a later compatible newChild can claim it.
      }
    }
    // newKey set but not found in oldKeyed: pure insertion.

    if (matchedOld) {
      patchNode(matchedOld, newChild);
      if (parent.childNodes[i] !== matchedOld) {
        parent.insertBefore(matchedOld, parent.childNodes[i] || null);
      }
    } else {
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
 * Compute a synthetic key for each child. Returns an array parallel to
 * `nodes`. A child gets:
 *   - its explicit `data-card` / `id` / `data-key` value, or
 *   - a `__cls__:NODENAME.class` synthetic key when its nodeName+class
 *     is unique among the sibling set, or
 *   - `null` when neither applies (positional matching only).
 */
function computeChildKeys(nodes) {
  const keys = new Array(nodes.length).fill(null);
  const classCount = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n || n.nodeType !== Node.ELEMENT_NODE) continue;
    const explicit = n.getAttribute("data-card") || n.getAttribute("id") || n.getAttribute("data-key");
    if (explicit) {
      keys[i] = explicit;
      continue;
    }
    const cls = (n.getAttribute("class") || "").trim();
    if (!cls) continue;
    const k = `${n.nodeName}.${cls}`;
    classCount.set(k, (classCount.get(k) || 0) + 1);
  }
  for (let i = 0; i < nodes.length; i++) {
    if (keys[i] !== null) continue;
    const n = nodes[i];
    if (!n || n.nodeType !== Node.ELEMENT_NODE) continue;
    const cls = (n.getAttribute("class") || "").trim();
    if (!cls) continue;
    const k = `${n.nodeName}.${cls}`;
    if (classCount.get(k) === 1) {
      keys[i] = `__cls__:${k}`;
    }
  }
  return keys;
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
    // Null-safe: oldNode may have been detached during a sibling
    // replacement earlier in the same reconcileChildren pass. The
    // enclosing reconcile will insert the new node at the correct slot.
    if (!oldNode.parentNode) return;
    oldNode.parentNode.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Element nodes: update attributes then recurse on children
  if (oldNode.nodeType === Node.ELEMENT_NODE) {
    updateAttributes(oldNode, newNode);

    // Fast-path only for non-interactive leaf elements without `data-keep`.
    // Using innerHTML on interactive leaves (button/input/etc.) destroys
    // listeners attached programmatically; recurse instead so text-node
    // patching leaves the element identity intact.
    if (isFastPathLeaf(oldNode) && isFastPathLeaf(newNode)) {
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
 * Tags whose listeners and DOM identity must be preserved across patches.
 * For these, we never use the innerHTML fast-path.
 */
const INTERACTIVE = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A", "LABEL"]);

/**
 * A "fast-path leaf" is an element with no element children, no
 * interactive role, and no opt-out `data-keep` attribute. Only such
 * elements are eligible for the innerHTML shortcut in patchNode.
 */
function isFastPathLeaf(el) {
  return (
    el.nodeType === Node.ELEMENT_NODE &&
    el.children.length === 0 &&
    !INTERACTIVE.has(el.nodeName) &&
    !el.hasAttribute("data-keep")
  );
}

/**
 * A leaf element has no child elements (only text/inline content).
 * Kept for backward compatibility; new fast-path checks use isFastPathLeaf.
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
 * Also installs a one-shot window scroll listener so restoreScrollState
 * can detect a user-initiated scroll that happened mid-render and skip
 * the scroll restore (B15 — do not fight the user's active scroll).
 */
function saveScrollState(container) {
  const state = {
    self: { top: container.scrollTop, left: container.scrollLeft },
    tableScrolls: [],
    userScrolled: false,
    onUserScroll: null
  };
  // Save scroll of any .table-scroll elements inside
  container.querySelectorAll(".table-scroll").forEach(el => {
    state.tableScrolls.push({ el, left: el.scrollLeft, top: el.scrollTop });
  });
  // Save window scroll
  state.window = { top: window.scrollY, left: window.scrollX };

  // One-shot listener: any scroll between save and restore flips the flag.
  state.onUserScroll = () => { state.userScrolled = true; };
  window.addEventListener("scroll", state.onUserScroll, { once: true, passive: true });

  return state;
}

/**
 * Restore scroll positions, but only when the user has not started
 * scrolling between save and restore. Always removes the one-shot
 * listener installed by saveScrollState.
 */
function restoreScrollState(container, scrollState) {
  try {
    const skip = scrollState.userScrolled === true;

    // Container scroll: gated by the same active-scroll guard so we do
    // not yank the page when the user is interacting.
    if (!skip) {
      if (container.scrollTop !== scrollState.self.top) {
        container.scrollTop = scrollState.self.top;
      }
      if (container.scrollLeft !== scrollState.self.left) {
        container.scrollLeft = scrollState.self.left;
      }
    }

    // Window scroll: only restore if the position actually drifted and
    // the user has not taken over scrolling.
    if (!skip && window.scrollY !== scrollState.window.top) {
      window.scrollTo(scrollState.window.left, scrollState.window.top);
    }

    // Table scroll restores: same gate.
    if (!skip && scrollState.tableScrolls.length) {
      const newScrollables = container.querySelectorAll(".table-scroll");
      scrollState.tableScrolls.forEach((saved, i) => {
        if (newScrollables[i]) {
          newScrollables[i].scrollLeft = saved.left;
          newScrollables[i].scrollTop = saved.top;
        }
      });
    }
  } finally {
    // Always remove the one-shot listener, even if it never fired
    // ({ once: true } would clean up on fire but not on a no-scroll path).
    if (scrollState.onUserScroll) {
      window.removeEventListener("scroll", scrollState.onUserScroll);
      scrollState.onUserScroll = null;
    }
  }
}
