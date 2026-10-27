/* Tiny template renderer for the Shape Shop preview pages.
   Reads <template id="page-tpl">, fills {{holes}}, repeats <sc-for>, shows <sc-if>,
   and wires onClick handlers from the page's Component class. */
(function () {
  'use strict';

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v === null || v === undefined) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var ANY = /\{\{\s*([^}]+?)\s*\}\}/g;

  function interp(str, scope) {
    return str.replace(ANY, function (_, p) {
      var v = lookup(p, scope);
      return v === undefined || v === null ? '' : String(v);
    });
  }

  function processChildren(srcParent, outParent, scope) {
    var kids = srcParent.childNodes;
    for (var i = 0; i < kids.length; i++) processNode(kids[i], outParent, scope);
  }

  function processNode(node, outParent, scope) {
    if (node.nodeType === 3) {
      outParent.appendChild(document.createTextNode(interp(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();

    if (tag === 'sc-for') {
      var listAttr = node.getAttribute('list') || '';
      var m = WHOLE.exec(listAttr);
      var list = m ? lookup(m[1], scope) : [];
      var as = node.getAttribute('as') || 'item';
      (list || []).forEach(function (item, idx) {
        var child = Object.create(scope);
        child[as] = item;
        child.$index = idx;
        processChildren(node, outParent, child);
      });
      return;
    }

    if (tag === 'sc-if') {
      var valAttr = node.getAttribute('value') || '';
      var mv = WHOLE.exec(valAttr);
      if (mv && lookup(mv[1], scope)) processChildren(node, outParent, scope);
      return;
    }

    var el = document.createElementNS(node.namespaceURI, node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var attr = node.attributes[a];
      var name = attr.name;
      var val = attr.value;
      if (name.indexOf('hint-') === 0) continue;
      if (/^on[a-z]+$/.test(name)) {
        var mh = WHOLE.exec(val);
        var fn = mh ? lookup(mh[1], scope) : null;
        if (typeof fn === 'function') {
          el.addEventListener(name.slice(2), (function (f) {
            return function (e) { f(e); };
          })(fn));
        }
        continue;
      }
      el.setAttribute(name, val.indexOf('{{') >= 0 ? interp(val, scope) : val);
    }
    var srcKids = tag === 'template' ? node.content : node;
    processChildren(srcKids, el, scope);
    outParent.appendChild(el);
  }

  window.DCLogic = function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  };
  window.DCLogic.prototype.setState = function (patch) {
    Object.assign(this.state, patch);
    window.__dcRender();
  };
  window.DCLogic.prototype.forceUpdate = function () { window.__dcRender(); };

  window.__dcMount = function (Component) {
    var tpl = document.getElementById('page-tpl');
    var root = document.getElementById('page-root');
    var inst = new Component({});
    window.__dcRender = function () {
      var focusedLabel = document.activeElement && document.activeElement.getAttribute
        ? document.activeElement.getAttribute('aria-label') : null;
      var frag = document.createDocumentFragment();
      processChildren(tpl.content, frag, inst.renderVals());
      root.replaceChildren(frag);
      if (focusedLabel) {
        var again = root.querySelector('[aria-label="' + focusedLabel.replace(/"/g, '\\"') + '"]');
        if (again) again.focus({ preventScroll: true });
      }
    };
    window.__dcRender();
  };
})();
