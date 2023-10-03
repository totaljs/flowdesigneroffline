String.prototype.isJSON = function() {
	var self = this;
	if (self.length <= 1)
		return false;

	var l = self.length - 1;
	var a;
	var b;
	var i = 0;

	while (true) {
		a = self[i++];
		if (a === ' ' || a === '\n' || a === '\r' || a === '\t')
			continue;
		break;
	}

	while (true) {
		b = self[l--];
		if (b === ' ' || b === '\n' || b === '\r' || b === '\t')
			continue;
		break;
	}

	return (a === '"' && b === '"') || (a === '[' && b === ']') || (a === '{' && b === '}') || (a.charCodeAt(0) > 47 && b.charCodeAt(0) < 57);
};

String.prototype.parseComponent = function(tags) {

	var html = this;
	var beg = -1;
	var end = -1;
	var output = {};

	for (var key in tags) {

		var tagbeg = tags[key];
		var tagindex = tagbeg.indexOf(' ');

		if (tagindex === -1)
			tagindex = tagbeg.length - 1;

		var tagend = '</' + tagbeg.substring(1, tagindex) + '>';
		var tagbeg2 = '<' + tagend.substring(2);

		beg = html.indexOf(tagbeg);

		if (beg !== -1) {

			var count = 0;
			end = -1;

			for (var j = (beg + tagbeg.length); j < html.length; j++) {
				var a = html.substring(j, j + tagbeg2.length);
				if (a === tagbeg2) {
					count++;
				} else {
					if (html.substring(j, j + tagend.length) === tagend) {
						if (count) {
							count--;
						} else {
							end = j;
							break;
						}
					}
				}
			}

			if (end !== -1) {
				var tmp = html.substring(html.indexOf('>', beg) + 1, end);
				html = html.replace(html.substring(beg, end + tagend.length), '').trim();
				output[key] = tmp.replace(/^\n|\n$/, '');
			}

		}
	}

	return output;
};

FUNC.parsecomponent = function(val) {

	var meta = val.parseComponent({ readme: '<readme>', settings: '<settings>', css: '<style>', be: '<script total>', be2: '<script node>', js: '<script>', html: '<body>', schema: '<schema>', template: '<template>' });
	var node = (meta.be || meta.be2 || '').trim().replace(/\n\t/g, '\n');
	var fn = new Function('exports', 'require', node);
	var obj = {};

	fn(obj, () => EMPTYOBJECT);

	delete meta.make;
	delete meta.install;
	delete meta.uninstall;

	obj.settings = meta.settings;
	obj.css = meta.css;
	obj.readme = meta.readme;
	obj.js = meta.js;
	obj.html = meta.html;
	obj.schema = meta.schema;
	obj.template = meta.template;

	return obj;

};

COMPONENT('websocket', function(self) {

	var empty = { id: Date.now().toString(36), components: {}, design: {}, variables: {}, readme: '', name: 'FlowStream' };
	var flow = CLONE(empty);

	self.load = function(val) {

		if (!val) {
			val = CLONE(empty);
			val.id = Date.now().toString(36);
		}

		flow = val;
		self.send({ TYPE: 'flow' });
	};

	var sendcomponents = function() {
		var arr = [];
		for (var key in flow.components) {
			var m = FUNC.parsecomponent(flow.components[key]);
			var obj = {};
			obj.id = m.id || key;
			obj.name = m.name;
			obj.css = m.css;
			obj.icon = m.icon;
			obj.config = CLONE(m.config);
			obj.html = m.html;
			obj.js = m.js;
			obj.schema = m.schema;
			obj.readme = m.readme;
			obj.group = m.group;
			obj.version = m.version;
			obj.author = m.author;
			obj.settings = m.settings;
			obj.outputs = CLONE(m.outputs);
			obj.inputs = CLONE(m.inputs);
			arr.push(obj);
		}

		EMIT('message', { TYPE: 'flow/components', data: arr });
	};

	var sendmeta = function() {
		var obj = {};
		obj.TYPE = 'flow/flowstream';
		obj.id = flow.id;
		obj.version2 = flow.version;
		obj.version = 0;
		obj.paused = false;
		obj.node = 0;
		obj.total = 0;
		obj.name = flow.name;
		obj.icon = flow.icon;
		obj.reference = flow.reference;
		obj.group = flow.group;
		obj.author = flow.author;
		obj.color = flow.color;
		obj.origin = flow.origin;
		obj.notify = flow.notify;
		obj.readme = flow.readme;
		obj.proxypath = flow.proxypath;
		obj.memory = flow.memory;
		obj.url = flow.url;
		obj.env = flow.env;
		obj.worker = flow.worker;
		obj.cloning = flow.cloning;
		EMIT('message', obj);
	};

	self.send = function(msg) {

		var obj;

		switch (msg.TYPE) {
			case 'flow':

				sendmeta();

				obj = {};
				obj.TYPE = 'flow/variables';
				obj.data = flow.variables;
				EMIT('message', obj);

				sendcomponents();

				obj = {};
				obj.TYPE = 'flow/design';
				obj.data = CLONE(flow.design);
				EMIT('message', obj);
				break;

			case 'move':
				obj = flow.design[msg.id];
				obj.x = msg.x;
				obj.y = msg.y;
				break;

			case 'meta':
				COPY(msg.data, flow);
				sendmeta();
				break;

			case 'variables':
				obj = {};
				flow.variables = CLONE(msg.data);
				obj.TYPE = 'flow/variables';
				obj.data = msg.data;
				EMIT('message', obj);
				break;

			case 'export':
				obj = {};
				obj.TYPE = 'flow/export';
				obj.callbackid = msg.callbackid;
				obj.data = CLONE(flow);
				EMIT('message', obj);
				break;

			case 'trigger':
				// msg.id
				break;

			case 'save':
				flow.design = CLONE(msg.data);
				// save
				if (W === W.top) {
					SETTER('filesaver/save', flow.name + '.json', JSON.stringify(flow, null, '\t'), 'application/json');
				} else {
					obj = {};
					obj.TYPE = 'save';
					obj.flow = 1;
					obj.data = flow;
					W.parent.postMessage(JSON.stringify(obj), '*');
				}
				break;

			case 'component_save':

				flow.components[msg.id] = msg.data;
				obj = {};
				obj.callbackid = msg.callbackid;
				obj.id = msg.id;
				EMIT('message', obj);

				sendcomponents();

				obj = {};
				obj.TYPE = 'flow/design';
				obj.data = CLONE(flow.design);
				EMIT('message', obj);
				break;

			case 'component_read':
				obj = {};
				obj.TYPE = 'flow/component_read';
				obj.id = msg.id;
				obj.callbackid = msg.callbackid;
				obj.data = flow.components[msg.id];
				EMIT('message', obj);
				break;

			case 'component_remove':

				delete flow.components[msg.id];
				var removed = [];

				for (let key in flow.design) {
					let tmp = flow.design[key];
					if (tmp.component === msg.id) {
						delete flow.design[key];
						removed.push(key);
					}
				}

				sendcomponents();
				obj = {};
				obj.TYPE = 'flow/design';
				obj.data = CLONE(flow.design);
				EMIT('message', obj);
				break;
		}

		// {"TYPE":"flow/status","id":"iljfdlpo5","data":{}}


	};

});
