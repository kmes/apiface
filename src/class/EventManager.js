import { EVENT_TYPE } from './config/constants';

export default class EventManager {
    constructor() {
        var eventsName = Object.keys( EVENT_TYPE );

        this.listeners = {};
        for( let name of eventsName ) {
            this.listeners[ name ] = [
                {
                    priority: 0,
                    handler: function() {}
                }
            ];
        }
    }

    addEventListener( evtName, callback, priority=null ) {
        var errorMsg = '';
        if( !evtName || typeof evtName !== 'string' ) errorMsg = 'Event\'s name is not defined.';
        if( typeof callback !== 'function' ) errorMsg = 'Callback is not defined';
        if( !this.listeners[ evtName ] ) errorMsg = 'Event\'s name is not valid.';

        if( errorMsg ) {
            throw new Error( errorMsg );
            //return false;
        }

        var truePriority = this.getTruePriority( evtName, priority );

        this.listeners[ evtName ].push({
            priority: truePriority,
            handler: callback
        });

        this.sortListener();

        return truePriority;
    }

    getTruePriority( evtName, priority=null ) {
        if( !this.listeners[ evtName ] ) return false;

        var priorityList = Object.keys( this.listeners[ evtName ] ).sort();
        if( !+priority ) {
            return ( +priorityList.pop() )+1;
        }

        var truePriority = +priority;
        for( var i in priorityList ) {
            if( truePriority == i ) {
                truePriority++;
            }
            else if( truePriority < i ) {
                break;
            }
        }

        return truePriority;
    }

    sortListener() {
        for( let eventName in this.listeners ) {
            this.listeners[ eventName ].sort(function(a, b) {
                if( a.priority > b.priority ) {
                    return -1;
                }
                else {
                    return 1;
                }
            });
        }

        return this.listeners;
    }

    trigger( evtName, data=null ) {
        if( !this.listeners[ evtName ] ) return false;

        this.listeners[ evtName ].map(function( listener ) {
            listener.handler.call(this, {
                name: evtName,
                priority: listener.priority,
                data: data,
                dt: new Date().getTime(),
                handler: listener.handler
            });
        });

    }
}