# Introduction
`samsung-lfd` is a Node module to control Samsung large format displays over LAN-TCP or RS232-serial with JS and human friendly commands. It is NOT for use with Samsung TV sets.

## Main features
- different connection modes: tcp/serial/stream
- different schemas of connect-disconnect cycle
- command queuing and timing management
- event driven

## Usage
```js
const SamsungD = require('samsung-lfd');

//process commands using TCP socket
const dev = new SamsungD({name: 'sam3', host: '192.168.4.43', id: 3});
dev.emitter.on('responseFromDevice', data => console.log(data));
dev.process('power on', 'status?'); //power display on and ask for its status
/* expected response
{
  name: 'sam3',
  raw: <Buffer aa ff 03 03 41 11 01 58>,
  status: 'OK',
  req: 'power',
  value: 'on'
}
{
  name: 'sam3',
  raw: <Buffer 00 aa ff 03 09 41 00 01 14 00 22 01 00 00 84>,
  status: 'OK',
  req: 'status',
  value: {
    power: 'on',
    volume: 20,
    mute: 'off',
    input: 'HDMI1-PC',
    aspect: 1,
    NTimeNF: 0,
    FTimeNF: 0
  }
}
*/
```
# SamsungD Object
The primary exported object is `SamsungD`. It extensively uses `RAW` object from `raw-device` module as its prototype. Data necessary to process commands is in `samsungd.xml` file.

## Constructor `new SamsungD(AddressObject, OptionsObject)`
- `AddressObject <Object>` - required. Use only properties associated with the desired mode (serial, tcp, stream)
    - `name <string>` - default 'SamsungLFD'. The name is included in response object to easy identify a display
    - `id <number>` - default 0. NOTEs for stream mode: all displays in RS-232 chain must have unique id number. If you set id: 0xFE all displays execute commands, but none of them return a response.  
    //for serial
    - `path <string>` - required. Use valid serial path available in system.
    - `baudRate <number>` - default 9600
    - `dataBits <number>` - default 8
    - `parity <string>` - default 'none'
    - `stopBits <number>` - default 1  
    //for tcp
    - `host <string>` - required. Use valid IP address of display
    - `port <number>` - default 1515    
    //for stream
    - `stream <Stream>` - required. The stream must be an opened read/write Node stream. This mode is used when multiple displays are chained with RS232 cables and connected to a single system serial port. SamsungD object does not care about the stream. You have to maintain stream yourself (open, close, error handling).
- `OptionsObject <Object>` - optional, default is `{wDuration: 1000, rDuration: 1000, disconnect: true, splitter: {timeout: 700}}`
    - `wDuration <number>` - Inter-command period [ms] for set commands. A time for device to process command and to prepare and send a response.
    - `rDuration <number>` - Inter-command period [ms] for read commands. A time for device to prepare and send a response.
    - `disconnect <boolean|number>` - Connecion cycle scheme. Use true, false or timeout[ms]. True means close connection when command queue is empty, false means do not close connection, number means close connection after some ms. of connection inactivity.
    - `splitter <Object>` Used to select one among three supported transform streams which merge incoming data chunks and split it into valid messages. Only single property from delimiter, regex, timeout can be used.
        - `timeout <number>` - use `@serialport/parser-inter-byte-timeout` with timeout. Response is completed if inter-byte time is longer then timeout. Please consider that timeout must be shorter than durations (inter-command period) and disconnect time (if disconnect uses timeout scheme)

## Method `process(...commands)`
Encode and send commands to display. You can use multiple commands in single call. Commands will be queued and executed FIFO.

### Regular commands
Commands are based on Samsung Multiple Display Control (MDC) protocol. Commands are strings in human friendly form `command[?] [parameter(s)]`.  If command needs multiple parameters, they are separated by commas.
Some examples:   
`power off` - power off the display    
`input HDMI1` - set active input to HDMI1  
`sernum?` - get display serial number.   
`wallDef 3x3,1` - set matrix/wall mode (using internal signal scaler). This sets the display as upper left in 3x3 wall.  
Not all MDC commands are supported. All supported commands with their usage are listed in `samsungd.xml` file.  
NOTE: You can also use MDC commands which are not listed in XML file. In this case use command number, not a name. Parameters (if any) must also be numbers. For hex numbers use `0x` prefix. Example: `0x85 80`. This sets display max working temperature to 80<sup>o</sup>C

### Internal commands
There are some internal commands which start with `#`. They are not sent to device, but are processed by SamsungD object itself.  
- `#pause duration` - append additional pause between neighboring commands as number of miliseconds.
- `#connect` -  force to open connection to device.
- `#close` - force to close connection to device.

## Event: `commandForDevice`
Emited when command is properly encoded and sent to device. Of course only `encoded` property is sent to device itself.
- `command <Object>`
    - `name <string>` - device name
    - `command <string>` - a command itself, not parsed or encoded
    - `encodedstr <string>` - command encoded as string
    - `encoded <Buffer>` - command encoded as Buffer
    - `duration <number>` - time [ms] for device to process the command.

## Event: `responseFromDevice`
Emited when device response is properly decoded.
- `response <Object>`
    - `name <string>` - device name
    - `raw <Buffer>` - not decoded raw response
    - `req <string|number>` - request id, used to identify response. It is just a command name or command number which response is for.
    - `value <string|number|Object>` - decoded response value. Return type depends on command. See `samsungd.xml`  
    - `status <'OK'|'ERR'>` - response status. Corresponds to Ack(A) and Nak(N) in MDC

## Event: `connectionData`
Data which comes directly from device port "as is". Not decoded, merged or chopped by splitter. Event is not emited in stream mode.
- `dataObj <Object>`
    - `name <string>` - device name
    - `address <string>` - device address as string
    - `data <Buffer>` - data itself

## Event: `connectionStatus`
Emited when device connection status changes. Event is not emited in stream mode.
- `statusObj <Object>`
    - `name <string>` - device name
    - `dev <string>` - obsolete, same as name
    - `address <string>` - device address as string
    - `status <string>` - connection status
    - `more <string|Object>` - additional status information
