# Introduction
`lilliput-monitor` is a Node module to control Lilliput monitors over LAN-UDP with JS and human friendly commands.

## Main features
- different connection modes: udp/stream
- different schemas of connect-disconnect cycle
- command queuing and timing management
- event driven

## Usage
```js
const LilliputD = require('lilliput-monitor');

//process commands using UDP socket
const dev = new LilliputD({name: 'lil3', host: '192.168.4.43'});
dev.emitter.on('responseFromDevice', data => console.log(data));
dev.process('input sdi1'); //set SDI1 input
```
# LilliputD Object
The primary exported object is `LilliputD`. It extensively uses `RAW` object from `raw-device` module as its prototype. Data necessary to process commands is in `lilliputd.xml` file.

## Constructor `new LilliputD(AddressObject, OptionsObject)`
- `AddressObject <Object>` - required. Use only properties associated with the desired mode (serial, tcp, stream)
    - `name <string>` - default 'LilliputMonitor'. The name is included in response object to easy identify a display
    //for UDP
    - `host <string>` - required. Use valid IP address of display
    - `port <number>` - default 19523
    //for stream
    - `stream <Stream>` - required. The stream must be an opened read/write Node stream. This mode is used when multiple displays are chained with RS232 cables and connected to a single system serial port. LilliputD object does not care about the stream. You have to maintain stream yourself (open, close, error handling).
- `OptionsObject <Object>` - optional, default is `{wDuration: 1000, rDuration: 1000, disconnect: true, splitter: {timeout: 700}}`
    - `wDuration <number>` - Inter-command period [ms] for set commands. A time for device to process command and to prepare and send a response.
    - `rDuration <number>` - Inter-command period [ms] for read commands. A time for device to prepare and send a response.
    - `disconnect <boolean|number>` - Connecion cycle scheme. Use true, false or timeout[ms]. True means close connection when command queue is empty, false means do not close connection, number means close connection after some ms. of connection inactivity.
    - `splitter <Object>` Used to select one among three supported transform streams which merge incoming data chunks and split it into valid messages. Only single property from delimiter, regex, timeout can be used.
        - `timeout <number>` - use `@serialport/parser-inter-byte-timeout` with timeout. Response is completed if inter-byte time is longer then timeout. Please consider that timeout must be shorter than durations (inter-command period) and disconnect time (if disconnect uses timeout scheme)

## Method `process(...commands)`
Encode and send commands to display. You can use multiple commands in single call. Commands will be queued and executed FIFO.

### Regular commands
Commands are based on Lilliput control protocol. Commands are strings in human friendly form `command[?] [parameter(s)]`.  If command needs multiple parameters, they are separated by commas.
Some examples:   
`input SDI1` - set active input to SDI1  
Not all commands are supported. All supported commands with their usage are listed in `lilliputd.xml` file.  
NOTE: You can also use commands which are not listed in XML file. In this case use command number, not a name. Parameters (if any) must also be numbers. For hex numbers use `0x` prefix.

### Internal commands
There are some internal commands which start with `#`. They are not sent to device, but are processed by LilliputD object itself.  
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
    - `value <string|number|Object>` - decoded response value. Return type depends on command. See `lilliputd.xml`  
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
