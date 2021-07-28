const electron = require('electron');
const os = require('os');
const path = require('path');
const common = require('./common');
const is = require('./is');

exports.chromeVersion = process.versions.chrome.replace(/\.\d+$/, '');

exports.enforceMacOSAppLocation = require('./source/enforce-macos-app-location');

exports.menuBarHeight = () => is.macos ? electron.screen.getPrimaryDisplay().workArea.y : 0;

exports.getWindowBoundsCentered = options => {
	options = {
		window: common.activeWindow(),
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
		window: common.activeWindow(),
		animated: false,
		...options
	};

	const bounds = exports.getWindowBoundsCentered(options);
	options.window.setBounds(bounds, options.animated);
};

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

exports.debugInfo = () => `
${electron.app.getName()} ${electron.app.getVersion()}
Electron ${exports.electronVersion}
${process.platform} ${os.release()}
Locale: ${electron.app.getLocale()}
`.trim();

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
