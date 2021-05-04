'use strict';
const {shell} = require('electron');
const is = require('./is');

module.exports = async (pane, section) => {
	if (!is.macos) {
		return;
	}

	await shell.openExternal(`x-apple.systempreferences:com.apple.preference.${pane}${section ? `?${section}` : ''}`);
};
