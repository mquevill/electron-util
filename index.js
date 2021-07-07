'use strict';
const os = require('os');
const path = require('path');
const electron = require('electron');
const newGithubIssueUrl = require('new-github-issue-url');
const node = require('./node');

const is = require('./source/is');

exports.is = is;

exports.electronVersion = node.electronVersion;

// TODO: Move to main
exports.chromeVersion = process.versions.chrome.replace(/\.\d+$/, '');

// TODO: Move to shared
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

// TODO: Move to main?
const activeWindow = () => is.main ?
	electron.BrowserWindow.getFocusedWindow() :
	electron.remote.getCurrentWindow();

exports.activeWindow = activeWindow;

// TODO: Move to shared? (webFrame)
exports.runJS = (code, win = activeWindow()) => win.webContents.executeJavaScript(code);

// TODO: Move to main
exports.fixPathForAsarUnpack = node.fixPathForAsarUnpack;

// TODO: Move to main
exports.enforceMacOSAppLocation = require('./source/enforce-macos-app-location');

// TODO: Move to main
exports.menuBarHeight = () => is.macos ? electron.screen.getPrimaryDisplay().workArea.y : 0;

// TODO: Move to main
exports.getWindowBoundsCentered = options => {
	options = {
		window: activeWindow(),
		...options
	};

	const [width, height] = options.window.getSize();
	const windowSize = options.size || {width, height};
	const screenSize = electron.screen.getDisplayNearestPoint(electron.screen.getCursorScreenPoint()).workArea;
	const x = Math.floor(screenSize.x + ((screenSize.width / 2) - (windowSize.width / 2)));
	const y = Math.floor(((screenSize.height + screenSize.y) / 2) - (windowSize.height / 2));

	return {
		x,
		y,
		width: windowSize.width,
		height: windowSize.height
	};
};

// TODO: Move to main
exports.centerWindow = options => {
	options = {
		window: activeWindow(),
		animated: false,
		...options
	};

	const bounds = exports.getWindowBoundsCentered(options);
	options.window.setBounds(bounds, options.animated);
};

// TODO: Move to shared? (webFrame)
exports.disableZoom = (win = activeWindow()) => {
	const {webContents} = win;

	const run = () => {
		webContents.setZoomFactor(1);
		webContents.setLayoutZoomLevelLimits(0, 0);
	};

	webContents.on('did-finish-load', run);
	run();
};

// TODO: Move to shared
exports.appLaunchTimestamp = Date.now();

// TODO: Move to main
if (is.main) {
	const isFirstAppLaunch = () => {
		const fs = require('fs');
		const checkFile = path.join(electron.app.getPath('userData'), '.electron-util--has-app-launched');

		if (fs.existsSync(checkFile)) {
			return false;
		}

		try {
			fs.writeFileSync(checkFile, '');
		} catch (error) {
			if (error.code === 'ENOENT') {
				fs.mkdirSync(electron.app.getPath('userData'));
				return isFirstAppLaunch();
			}
		}

		return true;
	};

	exports.isFirstAppLaunch = isFirstAppLaunch;
}

// TODO: Move to main
exports.darkMode = {
	get isEnabled() {
		if (!is.macos) {
			return false;
		}

		return electron.nativeTheme.shouldUseDarkColors;
	},

	onChange(callback) {
		if (!is.macos) {
			return () => {};
		}

		const handler = () => {
			callback();
		};

		electron.nativeTheme.on('updated', handler);

		return () => {
			electron.nativeTheme.off(handler);
		};
	}
};

// TODO: Move to main
exports.setContentSecurityPolicy = async (policy, options) => {
	await electron.app.whenReady();

	if (!policy.split('\n').filter(line => line.trim()).every(line => line.endsWith(';'))) {
		throw new Error('Each line must end in a semicolon');
	}

	policy = policy.replace(/[\t\n]/g, '').trim();

	options = {
		session: electron.session.defaultSession,
		...options
	};

	options.session.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				'Content-Security-Policy': [policy]
			}
		});
	});
};

// TODO: Move to shared
exports.openNewGitHubIssue = options => {
	const url = newGithubIssueUrl(options);
	electron.shell.openExternal(url);
};

// TODO: Move to shared
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

// TODO: Move to main
exports.showAboutWindow = (options = {}) => {
	// TODO: When https://github.com/electron/electron/issues/18918 is fixed,
	// these defaults should not need to be set for Linux.
	// TODO: The defaults are standardized here, instead of being set in
	// Electron when https://github.com/electron/electron/issues/23851 is fixed.

	const appName = electron.app.getName();
	const appVersion = electron.app.getVersion();

	const aboutPanelOptions = {
		applicationName: appName,
		applicationVersion: appVersion
	};

	if (options.icon) {
		aboutPanelOptions.iconPath = options.icon;
	}

	if (options.copyright) {
		aboutPanelOptions.copyright = options.copyright;
	}

	if (options.text) {
		aboutPanelOptions.copyright = (options.copyright || '') + '\n\n' + options.text;
	}

	if (options.website) {
		aboutPanelOptions.website = options.website;
	}

	electron.app.setAboutPanelOptions(aboutPanelOptions);
	electron.app.showAboutPanel();
};

// TODO: Move to main
exports.aboutMenuItem = (options = {}) => {
	options = {
		title: 'About',
		...options
	};

	// TODO: When https://github.com/electron/electron/issues/15589 is fixed,
	// handle the macOS case here, so the user doesn't need a conditional
	// when used in a cross-platform app

	return {
		label: `${options.title} ${electron.app.getName()}`,
		click() {
			exports.showAboutWindow(options);
		}
	};
};

// TODO: Move to main
exports.debugInfo = () => `
${electron.app.getName()} ${electron.app.getVersion()}
Electron ${exports.electronVersion}
${process.platform} ${os.release()}
Locale: ${electron.app.getLocale()}
`.trim();

// TODO: Move to main
exports.appMenu = (menuItems = []) => {
	// TODO: When https://github.com/electron/electron/issues/15589 is fixed,
	// handle the macOS case here, so the user doesn't need a conditional
	// when used in a cross-platform app

	return {
		label: electron.app.getName(),
		submenu: [
			{
				role: 'about'
			},
			{
				type: 'separator'
			},
			...menuItems,
			{
				type: 'separator'
			},
			{
				role: 'services'
			},
			{
				type: 'separator'
			},
			{
				role: 'hide'
			},
			{
				role: 'hideothers'
			},
			{
				role: 'unhide'
			},
			{
				type: 'separator'
			},
			{
				role: 'quit'
			}
		].filter(Boolean)
	};
};

// TODO: Move to shared
exports.openSystemPreferences = require('./source/open-system-preferences');

// TODO: Move more of the larger methods here into separate files.
