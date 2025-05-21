const RAW = require('raw-device');
const fs = require('fs');
const xml2js = require('xml2js');

/* SamsungD object uses RAW object as its prototype */
SamsungD.prototype = Object.create(RAW.prototype);
SamsungD.prototype.constructor = SamsungD;

SamsungD.prototype.addressDefaults = {
    name: 'SamsungLFD',
    id: 0, //0xFE all displays, no ACK
	//tcp
	port: 1515,
	//serial
	baudRate: 9600,
	dataBits:8,
	parity: 'none',
	stopBits: 1
}

SamsungD.prototype.optionsDefaults = {
    disconnect: true,
	encoding: null,
	wDuration: 1000,
	rDuration: 1000,
    dataname: 'samsungd.xml',
	splitter: {
		timeout: 700
	}
}

/**
 * Constructor for Samsung object
 * @constructor
 * @param {AddressObject} address
 * @param {OptionsObject} [options]
 */
function SamsungD(address, options={}) {
    RAW.call(this, address, options);
	this.id = this.address.id;
	this.data;
	let dataName = this.options.dataname;
    let parser = new xml2js.Parser({mergeAttrs: true, explicitArray: false});
    let dataXML = fs.readFileSync(__dirname + '/' + dataName);
    parser.parseString(dataXML, (err, json) => {
        this.data = json;
    });
}

/**
 * Encode command for device using its communication protocol
 * @param {string} cmd  - command to encode
 * @returns {CommandObject} cmdObj
 */
SamsungD.prototype.encode = function(cmd){
	if(cmd.startsWith('#')){
		let co = this.special(cmd);
        return co;
	}
	let res = /(\w+)(\?)? ?([\w-, ]*)/.exec(cmd)
	if(!res)
		return;
    let name = res[1];
	let mode = res[2];
	let parama = res[3].split(',');
	parama = parama.map(par => par.trim());
	let cmdObj = {
		name: this.name,
		command: cmd
	}
	if(mode == '?')
		cmdObj = Object.assign(cmdObj, this.getCommand(name))
	else 
		cmdObj = Object.assign(cmdObj, this.setCommand(name, parama))
	return cmdObj
}

SamsungD.prototype.setCommand = function(name, parameters){
	let code = Number(name); //& 0x00FF; 
	let params = parameters.map(el => Number(el)); //może też poobcinać do bajta	
	let duration = this.options.wDuration;

	let cmdef = this.data.dev.command.find(el => el.name.toLowerCase() == name.toLowerCase());
	if(cmdef){
		if(!cmdef.mode.includes('w')) //no set(write) mode for command
			return;
		code = Number(cmdef.code);
		let dur = cmdef.wDuration;
		if(dur)
			duration = Number(dur);
		let parDefArr = [];
		let parDef = cmdef.value;
		if(Array.isArray(parDef))
			parDefArr.push(...parDef);
		else 
			parDefArr.push(parDef);
		params = params.map((el, ind)  => {
			if(isNaN(el)){
				let sel = parDefArr[ind].item;
				if(Array.isArray(sel)){
					let item = sel.find(it => {
						let strvals = it.name.split(',');
						strvals = strvals.map(e => e.trim().toUpperCase());
						let strval = strvals.find(e => e == parameters[ind].toUpperCase());
						if(strval)
							return true;
					})
					if(item)
						return Number(item.value);
				}
			}
			else return el;
		})
	}

	if(isNaN(code))
		return;
	if(params.some(el => (isNaN(el)) || (el === undefined)))
		return;
	let commandStr = '\xAA';
	commandStr += String.fromCharCode(code);
	commandStr += String.fromCharCode(this.id);
	commandStr += String.fromCharCode(params.length);
	params.forEach((par) => {
		commandStr += String.fromCharCode(par);
	})
	let b = Buffer.from(commandStr, 'ascii');
	let chs = 0;
	for(let i=1; i<b.length; i++){
		chs += b[i];
	}
	chs = chs & 0x00FF;
	commandStr += String.fromCharCode(chs);

	let enc = {
		encodedStr: commandStr,
		encoded: Buffer.from(commandStr, 'ascii'),
		duration: duration
	}
	return enc;
}

SamsungD.prototype.getCommand = function(name){
	let code = Number(name); //& 0x00FF;
	let duration = this.options.rDuration

	let cmdef = this.data.dev.command.find(el => el.name.toLowerCase() == name.toLowerCase());
	if(cmdef){
		code = Number(cmdef.code);
		let dur = cmdef.rDuration;
		if(dur)
			duration = Number(dur);
	}
	if(isNaN(code))
		return;
	let commandStr = '\xAA';
	commandStr += String.fromCharCode(code);
	commandStr += String.fromCharCode(this.id);
	commandStr += '\x00';
	let buf = Buffer.from(commandStr, 'ascii');
	let chs = 0;
	for(let i=1; i<buf.length; i++){
		chs += buf[i];
	}
	chs = chs & 0x00FF;
	commandStr += String.fromCharCode(chs);
	let enc = {
		encodedStr: commandStr,
		encoded: Buffer.from(commandStr, 'ascii'),
		duration: duration
	}
	return enc;
}

/**
 * Decode response from device to friendly form
 * @param {Buffer} data - a data from splitter
 * @fires SamsungD#responseFromDevice
 */
SamsungD.prototype.decode = function(data){
	let start = data.indexOf(0xAA);
	if(start == -1)// not a valid vessage
		return;
	let trimed;
	if(start >= 0)
		trimed = data.subarray(start);
	let id = trimed[2];
	if(id != this.id) //not for me response. Can happen when RS232 chain is used
		return;
	let result = {
		name: this.name,
        raw: data
    }
	let dlength = trimed[3];
	let ack = String.fromCharCode(trimed[4]);
	result['status'] = ack=='A'? 'OK': 'ERR';
	let rcmd = trimed[5];
	result['req'] = rcmd;
	let valbuff = trimed.subarray(6, 6+dlength-2);
	let valarr = [...valbuff];
	result['value'] = (valarr.length == 1)? valarr[0]: valarr;

	let cmdef = this.data.dev.command.find(el => Number(el.code) == rcmd);
	if(!cmdef){ //No command def in XML';
		this.emitter.emit('responseFromDevice', result)
		return result;
	}
	result['req'] = cmdef['name'];

	let valDefArr = [];
	let valdef = cmdef.value;
	if(Array.isArray(valdef))
		valDefArr.push(...valdef);
	else 
		valDefArr.push(valdef);

	if(valbuff.length != valDefArr.length){ //ascii response	
		let str = valbuff.toString('ascii');
		result['value'] = str.replaceAll('\x00', '')
	}
	else if(valDefArr.length == 1){ //single value
		let v = valbuff[0];
		result['value'] = v;
		if(valDefArr[0])
			if(valDefArr[0].item){
				let sel = valDefArr[0].item;
				let item = sel.find(it =>  parseInt(it.value) == v);
				if(item){
					let narr = item.name.split(',')
					result['value'] = narr[0].trim();
				}
			}
	}
	else{ // multiple values
		let valObj = {}
		valDefArr.forEach((el, ind) => {
			let vname = el.name? el.name: ind.toString();
			let v = valbuff[ind];
			valObj[vname] = v;
			if(Array.isArray(el.item)){
				let item = el.item.find(it => parseInt(it.value) == v)
				if(item){
					let narr = item.name.split(',')
					valObj[vname] = narr[0].trim();
				}
			}
		});
		result['value'] = valObj;
	}
	this.emitter.emit('responseFromDevice', result)
	return result;
}

module.exports = SamsungD;