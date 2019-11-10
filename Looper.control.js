loadAPI(7);
load ("TrackHandler.js");

// Remove this if you want to be able to use deprecated methods without causing script to stop.
// This is useful during development.
host.setShouldFailOnDeprecatedUse(true);

host.defineController("solinas", "Looper", "0.1", "f8eed033-2af4-49c4-b9ee-caed23a7913a", "solinas");

host.defineMidiPorts(1, 0);


function init() {
   host.getMidiInPort(0).setMidiCallback(handleMidi);
   trackHandler = new TrackHandler (host);
   println("Looper initialized!");
}

// Called when a short MIDI message is received on MIDI input port 0.
function handleMidi (status, data1, data2)
{
   if (trackHandler.handleMidi (status, data1, data2))
      return;

   host.errorln ("Midi command not processed: " + status + " : " + data1);
}

function flush() {
   // TODO: Flush any output to your controller here.
}

function exit() {

}