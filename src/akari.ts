// # Chinachu Common Module (chinachu-akari)

/// <reference path="ref/node.d.ts"/>
'use strict';

var fs         = require('fs');
var crypto     = require('crypto');
var dateFormat = require('dateformat');
var execSync   = require('execsync');

exports.log = (message: string) => {
    util.puts(message);
};

exports.jsonWatcher = function (filepath, callback, option) {
	if (typeof option === 'undefined') { option = {}; }
	
	option.wait = option.wait || 1000;
	
	if (!fs.existsSync(filepath)) {
		if (option.create) {
			fs.writeFileSync(filepath, JSON.stringify(option.create));
		} else {
			callback('FATAL: `' + filepath + '` is not exists.', null, null);
			return;
		}
	}
	
	var data = null;
	
	var parse = function (err, json) {
		if (err) {
			callback('WARN: Failed to read `' + filepath + '`. (' + err + ')', null, null);
		} else {
			data = null;
			
			try {
				data = JSON.parse(json);
				callback(null, data, 'READ: `' + filepath + '` is updated.');
			} catch (e) {
				callback('WARN: `' + filepath + '` is invalid. (' + e + ')', null, null);
			}
		}
	};
	
	var timer = null;
	
	var read = function () {
		timer = null;
		
		fs.readFile(filepath, { encoding: 'utf8' }, parse);
	};
	
	if (option.now) { read(); }
	
	var onUpdated = function () {
		if (timer !== null) { clearTimeout(timer); }
		timer = setTimeout(read, option.wait);
	};
	fs.watch(filepath, onUpdated);
};

exports.getProgramById = function (id, array) {
	if (!array || array.length === 0) {
		return null;
	}
	
	if (array[0].programs) {
		array = (function () {
			var programs = [];
			
			array.forEach(function (ch) {
				programs = programs.concat(ch.programs);
			});
			
			return programs;
		}());
	}
	
	return (function () {
		var x = null;
		
		array.forEach(function (a) {
			if (a.id === id) { x = a; }
		});
		
		return x;
	}());
};

exports.existsTuner = function (tuners, type, callback) {
	
	process.nextTick(function () {
		callback(exports.existsTunerSync(tuners, type));
	});
};

exports.existsTunerSync = function (tuners, type) {
	
	var j, tuner, isExists = false;
	
	for (j = 0; tuners.length > j; j++) {
		tuner = tuners[j];
		tuner.n = j;
		
		if (tuner.types.indexOf(type) !== -1) {
			isExists = true;
			break;
		}
	}
	
	return isExists;
};

exports.getFreeTunerSync = function (tuners, type) {
	
	var j, exists, pid, tuner, freeTuner = null;
	
	for (j = 0; tuners.length > j; j++) {
		tuner = tuners[j];
		tuner.n = j;
		
		if (tuner.types.indexOf(type) === -1) {
			continue;
		}
		
		if (fs.existsSync('./data/tuner.' + j + '.lock') === true) {
			pid = fs.readFileSync('./data/tuner.' + j + '.lock', { encoding: 'utf8' });
			pid = pid.trim();
			
			if (pid === '') {
				continue;
			}
			
			if (execSync('kill -0 ' + pid) !== '') {
				exports.unlockTunerSync(tuner);
				freeTuner = tuner;
				break;
			}
		} else {
			freeTuner = tuner;
			break;
		}
	}
	
	return freeTuner;
};

exports.lockTuner = function (tuner, callback) {
	fs.writeFile('./data/tuner.' + tuner.n + '.lock', process.pid, { flag: 'wx' }, callback);
};

exports.lockTunerSync = function (tuner) {
	try {
		return fs.writeFileSync('./data/tuner.' + tuner.n + '.lock', process.pid, { flag: 'wx' });
	} catch (e) {
		throw e;
	}
};

exports.unlockTuner = function (tuner, callback) {
	fs.unlink('./data/tuner.' + tuner.n + '.lock', callback);
};

exports.unlockTunerSync = function (tuner, safe) {
	try {
		if (safe === true) {
			var pid = fs.readFileSync('./data/tuner.' + tuner.n + '.lock', { encoding: 'utf8' });
			if (pid !== '') {
				if (execSync('kill -0 ' + pid) === '') {
					return null;
				} else {
					return fs.unlinkSync('./data/tuner.' + tuner.n + '.lock');
				}
			}
		}
		return fs.unlinkSync('./data/tuner.' + tuner.n + '.lock');
	} catch (e) {
		throw e;
	}
};

exports.writeTunerPid = function (tuner, pid, callback) {
	fs.writeFile('./data/tuner.' + tuner.n + '.lock', pid, { flag: 'w' }, callback);
};

exports.writeTunerPidSync = function (tuner, pid) {
	try {
		return fs.writeFileSync('./data/tuner.' + tuner.n + '.lock', pid, { flag: 'w' });
	} catch (e) {
		throw e;
	}
};

var Countdown = function (count, callback) {
	this.c = count;
	this.f = callback;
};

Countdown.prototype = {
	tick: function () {
		
		--this.c;
		
		if (this.c === 0) {
			this.f();
		}
		
		return this;
	}
};

exports.createCountdown = function (a, b) {
	return new Countdown(a, b);
};

exports.createTimeout = function (a, b) {
	return function () {
		return setTimeout(a, b);
	};
};

exports.formatRecordedName = function (program, name) {
	name = name.replace(/<([^>]+)>/g, function (z, a) {
		
		// date:
		if (a.match(/^date:.+$/) !== null) { return dateFormat(new Date(program.start), a.match(/:(.+)$/)[1]); }
		
		// id
		if (a.match(/^id$/) !== null) { return program.id; }
		
		// type
		if (a.match(/^type$/) !== null) { return program.channel.type; }
		
		// channel
		if (a.match(/^channel$/) !== null) { return program.channel.channel; }
		
		// channel-id
		if (a.match(/^channel-id$/) !== null) { return program.channel.id; }
		
		// channel-sid
		if (a.match(/^channel-sid$/) !== null) { return program.channel.sid; }
		
		// channel-name
		if (a.match(/^channel-name$/) !== null) { return exports.stripFilename(program.channel.name); }
		
		// tuner
		if (a.match(/^tuner$/) !== null) { return program.tuner.name; }
		
		// title
		if (a.match(/^title$/) !== null) { return exports.stripFilename(program.title); }
		
		// fulltitle
		if (a.match(/^fulltitle$/) !== null) { return exports.stripFilename(program.fullTitle || ''); }
		
		// subtitle
		if (a.match(/^subtitle$/) !== null) { return exports.stripFilename(program.subTitle || ''); }
		
		// episode
		if (a.match(/^episode$/) !== null) { return program.episode || 'n'; }
		
		// category
		if (a.match(/^category$/) !== null) { return program.category; }
	});
	
	return name;
};

// strip
exports.stripFilename = function (a) {
	
	a = a.replace(/\//g, '／').replace(/\\/g, '＼').replace(/:/g, '：').replace(/\*/g, '＊').replace(/\?/g, '？');
	a = a.replace(/"/g, '”').replace(/</g, '＜').replace(/>/g, '＞').replace(/\|/g, '｜').replace(/≫/g, '＞＞');
	
	return a;
};

exports.isMatchedProgram = function (rules, program) {
	var result = false;
	
	rules.forEach(function (rule) {
		
		var i, j, l, m, isFound;
		
		// isDisabled
		if (rule.isDisabled) { return; }
		
		// sid
		if (rule.sid && rule.sid !== program.channel.sid) { return; }
		
		// types
		if (rule.types) {
			if (rule.types.indexOf(program.channel.type) === -1) { return; }
		}
		
		// channels
		if (rule.channels) {
			if (rule.channels.indexOf(program.channel.id) === -1) {
				if (rule.channels.indexOf(program.channel.channel) === -1) {
					return;
				}
			}
		}
		
		// ignore_channels
		if (rule.ignore_channels) {
			if (rule.ignore_channels.indexOf(program.channel.id) !== -1) {
				return;
			}
			if (rule.ignore_channels.indexOf(program.channel.channel) !== -1) {
				return;
			}
		}
		
		// category
		if (rule.category && rule.category !== program.category) { return; }
		
		// categories
		if (rule.categories) {
			if (rule.categories.indexOf(program.category) === -1) { return; }
		}
		
		// hour
		if (rule.hour && (typeof rule.hour.start !== 'undefined') && (typeof rule.hour.end !== 'undefined')) {
			var ruleStart = rule.hour.start;
			var ruleEnd   = rule.hour.end;
			
			var progStart = new Date(program.start).getHours();
			var progEnd   = new Date(program.end).getHours();
			
			if (progStart > progEnd) {
				progEnd += 24;
			}
			
			if (ruleStart > ruleEnd) {
				if ((ruleStart > progStart) && (ruleEnd < progEnd)) { return; }
			} else {
				if ((ruleStart > progStart) || (ruleEnd < progEnd)) { return; }
			}
		}
		
		// duration
		if (rule.duration && (typeof rule.duration.min !== 'undefined') && (typeof rule.duration.max !== 'undefined')) {
			if ((rule.duration.min > program.seconds) || (rule.duration.max < program.seconds)) { return; }
		}
		
		// reserve_titles
		if (rule.reserve_titles) {
			isFound = false;
			
			for (i = 0; i < rule.reserve_titles.length; i++) {
				if (program.fullTitle.match(rule.reserve_titles[i]) !== null) { isFound = true; }
			}
			
			if (!isFound) { return; }
		}
		
		// ignore_titles
		if (rule.ignore_titles) {
			for (i = 0; i < rule.ignore_titles.length; i++) {
				if (program.fullTitle.match(rule.ignore_titles[i]) !== null) { return; }
			}
		}
		
		// reserve_descriptions
		if (rule.reserve_descriptions) {
			if (!program.detail) { return; }
			
			isFound = false;
			
			for (i = 0; i < rule.reserve_descriptions.length; i++) {
				if (program.detail.match(rule.reserve_descriptions[i]) !== null) { isFound = true; }
			}
			
			if (!isFound) { return; }
		}
		
		// ignore_descriptions
		if (rule.ignore_descriptions) {
			if (!program.detail) { return; }
			
			for (i = 0; i < rule.ignore_descriptions.length; i++) {
				if (program.detail.match(rule.ignore_descriptions[i]) !== null) { return; }
			}
		}
		
		// ignore_flags
		if (rule.ignore_flags) {
			for (i = 0; i < rule.ignore_flags.length; i++) {
				for (j = 0; j < program.flags.length; j++) {
					if (rule.ignore_flags[i] === program.flags[j]) { return; }
				}
			}
		}
		
		// reserve_flags
		if (rule.reserve_flags) {
			if (!program.flags) { return; }
			
			isFound = false;
			
			for (i = 0; i < rule.reserve_flags.length; i++) {
				for (j = 0; j < program.flags.length; j++) {
					if (rule.reserve_flags[i] === program.flags[j]) { isFound = true; }
				}
			}
			
			if (!isFound) { return; }
		}
		
		result = true;
		
	});
	
	return result;
};