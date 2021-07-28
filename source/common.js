const electron = require('electron');
const remote = require('@electron/remote');
const newGithubIssueUrl = require('new-github-issue-url');
const is = require('./is');

const activeWindow = () => is.main ?
	electron.BrowserWindow.getFocusedWindow() :
	remote.getCurrentWindow();

exports.activeWindow = activeWindow;

exports.runJS = (code, win = activeWindow()) => win.webContents.executeJavaScript(code);

exports.disableZoom = (win = activeWindow()) => {
	const {webContents} = win;

	const run = () => {
		webContents.setZoomFactor(1);
		webContents.setLayoutZoomLevelLimits(0, 0);
	};

	webContents.on('did-finish-load', run);
	run();
};

exports.platform = object => {
	let {platform} = process;

	if (platform === 'darwin') {
		platform = 'macos';
	} else if (platform === 'win32') {
		platform = 'windows';
	}

	const fn = platform in object ? object[platform] : object.default;

	return typeof fn === 'function' ? fn() : fn;
};

exports.openNewGitHubIssue = options => {
	const url = newGithubIssueUrl(options);
	electron.shell.openExternal(url);
};

exports.openUrlMenuItem = (options = {}) => {
	if (!options.url) {
		throw new Error('The `url` option is required');
	}

	const {url} = options;
	delete options.url;

	const click = (...args) => {
		if (options.click) {
			options.click(...args);
		}

		electron.shell.openExternal(url);
	};

	return {
		...options,
		click
	};
};

exports.appLaunchTimestamp = Date.now();
