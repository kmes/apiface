import { getEventsName, promiseFactory } from './helper/helper';

import { DATA_STATUS } from './config/constants.js';

export default class PowerEntity {
    constructor({ entity, customAdapter, entityController, eventManager, safeMode = false }) {
        this.entity = entity;
        this.entityController = entityController;
        this.customAdapter = customAdapter;

        this.eventManager = eventManager;

        this.nodeAdded = [];

        this.safeMode = safeMode;
        if( this.safeMode ) {
            this.oldData = null;
        }
    }


    getEntity() {
        return this.entity;
    }
    getEntityController() {
        return this.entityController;
    }
    getEventManager() {
        return this.eventManager;
    }

    getCreateAt() {
        return this.getEntity().getCreateAt();
    }
    getUpdateAt() {
        return this.getEntity().getUpdateAt();
    }

    get() {
        let entity = this.getEntity();
        return entity.get.apply( entity, arguments );
    }
    set() {
        let entity = this.getEntity();
        return entity.set.apply( entity, arguments );
    }
    getData() {
        return this.getEntity().getData();
    }
    setData( data ) {
        if( !data ) return false;

        if( this.safeMode ) {
            this.oldData = Object.assing( {}, this.getData() );
        }

        this.getEntity().setData( data );

        return this;
    }
    addData( node ) {
        if( !node ) return false;

        this.getEntity().addData( node );

        this.nodeAdded.push( node );
    }

    getNodeAdded() {
        return this.nodeAdded;
    }
    resetNodeAdded() {
        return this.nodeAdded = [];
    }

    fetch( actionParams = {} ) {
        var promise = promiseFactory();

        var entity = this.getEntity();
        var entityController = this.getEntityController();
        var eventManager = this.getEventManager();

        entity.setActionParams( actionParams );
        var params = entity.getParams();

        var eventsName = getEventsName({
            method: 'fetch',
            dataStatus: entity.getStatus()
        });

        if( eventsName.request ) {
            eventManager.trigger( eventsName.request, {
                entity: entity,
                params: params
            });
        }

        entity.setStatus( DATA_STATUS.busy );

        entityController.readData({ uri: entity.getUri(), params: params, adapter: this.customAdapter })
            .then(function({ data, response }) {
                entity.setData( data );
                entity.setStatus( DATA_STATUS.synced );

                if( eventsName.success ) {
                    eventManager.trigger( eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve( entity );
            })
            .catch(function({ response }) {
                entity.setStatus( DATA_STATUS.error );

                if( eventsName.error ) {
                    eventManager.trigger( eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject( entity );
            });

        return promise.await;
    }

    save( actionParams = {} ) {
        var promise = promiseFactory();

        var entity = this.getEntity();
        var entityController = this.getEntityController();
        var eventManager = this.getEventManager();

        entity.setActionParams( actionParams );
        var params = entity.getParams();

        var eventsName = getEventsName({
            method: 'save',
            dataStatus: entity.getStatus()
        });

        if( eventsName.request ) {
            eventManager.trigger( eventsName.request, {
                entity: entity,
                params: params
            });
        }

        var status = entity.getStatus();
        switch( status ) {
            case DATA_STATUS.busy :
            case DATA_STATUS.pending :
                if( eventsName.error ) {
                    eventManager.trigger( eventsName.error, {
                        entity: entity,
                        error: status
                    });
                }
                promise.reject( entity );
                break;
            case DATA_STATUS.synced :
                if( eventsName.success ) {
                    eventManager.trigger( eventsName.success, {
                        entity: entity,
                        response: entity.getData()
                    });
                }
                promise.resolve( entity );
                break;
            case DATA_STATUS.created :
                entityController.createData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, checkIfExist: this.safeMode })
                    .then(function({ data, response }) {
                        entity.setData( data );
                        entity.setStatus( DATA_STATUS.synced );
                        if( eventsName.success ) {
                            eventManager.trigger( eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve( entity );
                    })
                    .catch(function({ response }) {
                        entity.setStatus( DATA_STATUS.error );
                        if( eventsName.error ) {
                            eventManager.trigger( eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject( entity );
                    });
                break;
            case DATA_STATUS.modified :
                entityController.updateData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, oldData: this.safeMode ? this.oldData : null })
                    .then(function({ data, response }) {
                        entity.setData( data );
                        entity.setStatus( DATA_STATUS.synced );
                        if( eventsName.success ) {
                            eventManager.trigger( eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve( entity );
                    })
                    .catch(function({ response }) {
                        entity.setStatus( DATA_STATUS.error );
                        if( eventsName.error ) {
                            eventManager.trigger( eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject( entity );
                    });
                break;
            case DATA_STATUS.added :
                entityController.pushData({ uri: entity.getUri(), data: this.getNodeAdded(), adapter: this.customAdapter })
                    .then(function({ data, response }) {
                        entity.setData( data );
                        entity.setStatus( DATA_STATUS.synced );

                        this.resetNodeAdded();

                        if( eventsName.success ) {
                            eventManager.trigger( eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }

                        promise.resolve( entity );
                    }.bind(this))
                    .catch(function({ response }) {
                        entity.setStatus( DATA_STATUS.error );

                        if( response && response.notAdded && response.notAdded.length ) {
                            this.resetNodeAdded();
                            for( let { node } of response.notAdded ) {
                                this.nodeAdded.push( node );
                            }
                        }

                        if( eventsName.error ) {
                            eventManager.trigger( eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }

                        promise.reject( entity );
                    }.bind(this));
                break;
            default :

                break;
        }

        return promise.await;
    }

    sync( callback = () => {} ) {
        var promise = promiseFactory();

        var entity = this.getEntity();
        var entityController = this.getEntityController();
        var eventManager = this.getEventManager();

        var eventsName = getEventsName({
            method: 'sync',
            dataStatus: entity.getStatus()
        });

        if( eventsName.request ) {
            eventManager.trigger( eventsName.request, {
                entity: entity,
                callback: callback
            });
        }

        entityController.onChangeData({ uri: entity.getUri(), adapter: this.customAdapter, callback: callback })
            .then(function({ data, response }) {
                entity.setData( data );
                entity.setStatus( DATA_STATUS.synced );

                if( eventsName.success ) {
                    eventManager.trigger( eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve( entity );
            })
            .catch(function({ response }) {
                entity.setStatus( DATA_STATUS.error );

                if( eventsName.error ) {
                    eventManager.trigger( eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject( entity );
            });

        return promise.await;
    }

    on( eventName = '', callback = () => {} ) {
        this.eventManager.addEventListener( eventName, function( response ) {
            if( !response || !response.data || !response.data.entity ) {
                return false; //todo: throw new error
            }

            var promise = promiseFactory();

            if( response.data.entity == this.getEntity() ) {
                if( response && response.error ) {
                    promise.reject.apply( this, arguments );
                }
                else {
                    promise.resolve.apply( this, arguments );
                }

                callback.apply( this, arguments );
            }
        }.bind(this));
    }
}