'use strict';
const os = require('os');
const path = require('path');
const electron = require('electron');
const newGithubIssueUrl = require('new-github-issue-url');
const node = require('./node');

const is = require('./source/is');

exports.is = is;

exports.electronVersion = node.electronVersion;

exports.chromeVersion = process.versions.chrome.replace(/\.\d+$/, '');

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

const activeWindow = () => is.main ?
	electron.BrowserWindow.getFocusedWindow() :
	electron.remote.getCurrentWindow();

exports.activeWindow = activeWindow;

exports.runJS = (code, win = activeWindow()) => win.webContents.executeJavaScript(code);

exports.fixPathForAsarUnpack = node.fixPathForAsarUnpack;

exports.enforceMacOSAppLocation = require('./source/enforce-macos-app-location');

exports.menuBarHeight = () => is.macos ? electron.screen.getPrimaryDisplay().workArea.y : 0;

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

exports.centerWindow = options => {
	options = {
		window: activeWindow(),
		animated: false,
		...options
	};

	const bounds = exports.getWindowBoundsCentered(options);
	options.window.setBounds(bounds, options.animated);
};

exports.disableZoom = (win = activeWindow()) => {
	const {webContents} = win;

	const run = () => {
		webContents.setZoomFactor(1);
		webContents.setLayoutZoomLevelLimits(0, 0);
	};

	webContents.on('did-finish-load', run);
	run();
};

exports.appLaunchTimestamp = Date.now();

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

exports.showAboutWindow = (options = {}) => {
	if (!is.windows) {
		if (
			options.copyright ||
			(is.linux && options.icon) ||
			(is.linux && options.website)
		) {
			const aboutPanelOptions = {
				copyright: options.copyright
			};

			if (is.linux && options.icon) {
				aboutPanelOptions.iconPath = options.icon;
				delete aboutPanelOptions.icon;
			}

			electron.app.setAboutPanelOptions(aboutPanelOptions);
		}

		electron.app.showAboutPanel();

		return;
	}

	options = {
		title: 'About',
		...options
	};

	// TODO: Make this just `electron.app.name` when targeting Electron 7.
	const appName = 'name' in electron.app ? electron.app.name : electron.app.getName();

	const text = options.text ? `${options.copyright ? '\n\n' : ''}${options.text}` : '';

	electron.dialog.showMessageBox({
		title: `${options.title} ${appName}`,
		message: `Version ${electron.app.getVersion()}`,
		detail: (options.copyright || '') + text,
		icon: options.icon,

		// This is needed for Linux, since at least Ubuntu does not show a close button
		buttons: [
			'OK'
		]
	});
};

exports.aboutMenuItem = (options = {}) => {
	options = {
		title: 'About',
		...options
	};

	// TODO: When https://github.com/electron/electron/issues/15589 is fixed,
	// handle the macOS case here, so the user doesn't need a conditional
	// when used in a cross-platform app

	const appName = 'name' in electron.app ? electron.app.name : electron.app.getName();

	return {
		label: `${options.title} ${appName}`,
		click() {
			exports.showAboutWindow(options);
		}
	};
};

exports.debugInfo = () => `
${'name' in electron.app ? electron.app.name : electron.app.getName()} ${electron.app.getVersion()}
Electron ${exports.electronVersion}
${process.platform} ${os.release()}
Locale: ${electron.app.getLocale()}
`.trim();

exports.appMenu = (menuItems = []) => {
	// TODO: When https://github.com/electron/electron/issues/15589 is fixed,
	// handle the macOS case here, so the user doesn't need a conditional
	// when used in a cross-platform app

	const appName = 'name' in electron.app ? electron.app.name : electron.app.getName();

	return {
		label: appName,
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

exports.openSystemPreferences = require('./source/open-system-preferences');

// TODO: Move more of the larger methods here into separate files.
