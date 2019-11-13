function TrackHandler (host)
{
    this.FEEDBACK_OPTIONS = ["OFF","ON"];

    this.host = host;
    this.counterRecord = 0;

    var preferences = host.getPreferences();
    this.decayFeedbackEnabled = preferences.getEnumSetting("enabled", "feedback", this.FEEDBACK_OPTIONS, this.FEEDBACK_OPTIONS[0]);
    this.decayFeedbackEnabled.markInterested();
    this.decayFeedbackValue = preferences.getNumberSetting("feedback value", "feedback", 0, 100, 1, "%", 100);
    this.decayFeedbackValue.markInterested();
    this.volumeMax = preferences.getNumberSetting("initial volume", "feedback", 0, 100, 1, "%", 80);
    this.volumeMax.markInterested();
    this.maxScene = preferences.getNumberSetting("number", "scene", 1, 8, 1, "scenes", 4);
    this.maxScene.markInterested();
    this.midichannel = preferences.getNumberSetting("channel","midi",1,16,1,"",1);
    this.midichannel.markInterested();
    this.recordNote = preferences.getNumberSetting("record / play / overdub note number","midi",0,127,1,"",0);
    this.recordNote.markInterested();
    this.undoNote = preferences.getNumberSetting("undo note number","midi",0,127,1,"",0);
    this.undoNote.markInterested();
    this.resetNote = preferences.getNumberSetting("reset note number","midi",0,127,1,"",0);
    this.resetNote.markInterested();

    this.currentTrack = 0;
    this.currentScene = 0;

    this.arrayVolumeTrack = [];

    this.cursorTrack = host.createCursorTrack ("LOOPER_CURSOR_TRACK", "LOOPER GroupTrack", 0, 0, true);
    this.trackbank = this.cursorTrack.createMainTrackBank(64,0,8,false);
    this.trackbank.channelCount().markInterested();
    for (i = 0; i < this.trackbank.getSizeOfBank(); i++)
    {
        var track = this.trackbank.getItemAt(i);
        track.volume().markInterested();
        track.arm().markInterested();
        track.volume ().setIndication(true);
        for(j=0;j < track.clipLauncherSlotBank().getSizeOfBank();j++)
        {
            track.clipLauncherSlotBank().getItemAt(j).isRecording().markInterested();
            track.clipLauncherSlotBank().getItemAt(j).isPlaying().addValueObserver(doObject(this,isFinishedRecording));
        }
    }
    this.cursorTrack.isPinned().addValueObserver(doObject(this,cursorTrackPinned));
}

function doObject (object, f)
{
    return function ()
    {
        f.apply (object, arguments);
    };
}

function mod(x, n)
{
    return (x % n + n) % n;
}

TrackHandler.prototype.handleMidi = function (status, data1, data2)
{
    if (MIDIChannel(status)+1 === this.midichannel.getRaw() && isNoteOn(status))
    {
        switch (data1)
        {
            case this.recordNote.getRaw(): // record
                if(this.trackbank.getItemAt(this.currentTrack).clipLauncherSlotBank().getItemAt(this.currentScene).isRecording().get())
                {
                    this.trackbank.getItemAt(this.currentTrack).clipLauncherSlotBank().launch(this.currentScene);
                    if(this.currentTrack >= this.trackbank.getSizeOfBank()-1)
                    {
                        this.currentScene = mod(++this.currentScene,this.trackbank.sceneBank().getSizeOfBank());
                    }
                    this.currentTrack = mod(++this.currentTrack,this.trackbank.getSizeOfBank());
                    this.counterRecord++;
                }
                else
                {
                    if(this.decayFeedbackEnabled.get() === this.FEEDBACK_OPTIONS[1]) setVolumes(this.trackbank,this.currentTrack,this.arrayVolumeTrack);
                    this.trackbank.getItemAt(this.currentTrack).clipLauncherSlotBank().record(this.currentScene);
                }
                return true;
                
            case this.undoNote.getRaw(): //undo
                if(this.counterRecord > 0){
                    undo(this);
                }
                return true;

            case this.resetNote.getRaw(): //reset
                var i = this.counterRecord;
                for(i;i>0;i--){
                    undo(this);
                }
                return true;

            default:
                return false;
        }
    }

    return false;    
}

cursorTrackPinned = function(isPinned){
    if(!isPinned) return;

    for(i=0; i < this.trackbank.getSizeOfBank(); i++)
    {
        var track = this.trackbank.getItemAt (i);
        track.volume().setIndication(false);
    }
    this.trackbank.setSizeOfBank(this.trackbank.channelCount().get());
    this.trackbank.sceneBank().setSizeOfBank(this.maxScene.getRaw());
    println(this.trackbank.sceneBank().getSizeOfBank());
    var currentVolume = this.volumeMax.get();
    for(i=0; i < this.trackbank.getSizeOfBank(); i++)
    {
        var track = this.trackbank.getItemAt (i);
        track.volume().setIndication(true);

        this.arrayVolumeTrack.push(currentVolume);
        currentVolume = currentVolume*(this.decayFeedbackValue.get());
    }
    armConfig(this.trackbank,0);
    this.currentTrack = 0;
    this.currentScene = 0;
    this.counterRecord = 0;
    this.host.showPopupNotification("configured with "+this.trackbank.channelCount().get()+ " tracks and "+
    this.maxScene.getRaw()+" scenes");
}

isFinishedRecording = function(isFinishedRecording)
{
    if(isFinishedRecording) armConfig(this.trackbank,this.currentTrack);
}

armConfig = function(trackbank,index)
{
    if(!trackbank.getItemAt(index).arm().get())
    {
        trackbank.getItemAt(index).arm().set(true);
    }
    for(i=0; i < trackbank.getSizeOfBank(); i++)
    {
        if(i != index)
        {
            trackbank.getItemAt(i).arm().set(false);
        }
    }
}

setVolumes = function(trackbank,currentTrack,arrayVolumeTrack)
{
    for(i=0; i > -trackbank.getSizeOfBank(); i-- )
    {
        trackbank.getItemAt(mod(currentTrack+i,trackbank.getSizeOfBank()))
            .volume()
            .setImmediately(arrayVolumeTrack[Math.abs(i)]);
    }
}

undo = function(obj)
{
    if(obj.currentTrack == 0)
    {
        obj.currentScene = mod(--obj.currentScene,obj.trackbank.sceneBank().getSizeOfBank());
    }
    obj.currentTrack = mod(--obj.currentTrack,obj.trackbank.getSizeOfBank());
    obj.trackbank.getItemAt(obj.currentTrack).clipLauncherSlotBank().deleteClip(obj.currentScene);
    armConfig(obj.trackbank,obj.currentTrack);
    if(obj.decayFeedbackEnabled.get() === obj.FEEDBACK_OPTIONS[1]) setVolumes(obj.trackbank,obj.currentTrack,obj.arrayVolumeTrack);
    obj.counterRecord--;
}


