import EventManager from './EventManager';
import EntityContainer from './EntityContainer';
import EntityController from './EntityController';
import EntityFactory from './EntityFactory';

import PowerEntity from './PowerEntity';

import { promiseFactory } from './helper/helper';

export default class Apiface {
    constructor({ adapter } = {}) {
        //this.defaultAdapter = adapter;
        this.setDefaultAdapter( adapter );

        this.entityContainer = new EntityContainer({ entityFactory: new EntityFactory() });

        this.entityController = new EntityController({ adapter: this.getDefaultAdapter() });
        this.eventManager = new EventManager();
    }

    setDefaultAdapter( adapter ) {
        return this.defaultAdapter = adapter;
    }
    getDefaultAdapter() {
        return this.defaultAdapter;
    }
    setAdapter( adapter ) {
        this.setDefaultAdapter( adapter );

        this.entityController.setAdapter( this.getDefaultAdapter() );
    }

    getEntityContainer() {
        return this.entityContainer;
    }
    getEntityController() {
        return this.entityController;
    }
    getEventManager() {
        return this.eventManager;
    }

    makePowerEntity({ entity, customAdapter }) {
        return new PowerEntity({
            entity: entity,
            customAdapter: customAdapter,
            entityController: this.getEntityController(),
            eventManager: this.getEventManager()
        });
    }

    getEntity({ name, uri, fixedParams, entityClass, customAdapter, overwrite = false }) {
        var entityContainer = this.getEntityContainer();

        var entity = null;
        if( overwrite ) {
            entity = entityContainer.setEntity({ name, uri, fixedParams, entityClass });
        }
        else {
            entity = entityContainer.getEntityByName( name ) || entityContainer.setEntity({ name, uri, fixedParams, entityClass });
        }

        if( !entity ) return null;

        if( uri ) entity.setUri( uri );
        if( fixedParams ) entity.setFixedParams( fixedParams );

        return this.makePowerEntity({ entity, customAdapter });
    }

    on( eventName = '', callback = () => {} ) {
        if( !eventName ) {
            return false;
        }

        var promise = promiseFactory();

        this.getEventManager().addEventListener( eventName, ( response ) => {
            if( response && response.error ) {
                promise.reject.apply( this, arguments );
            }
            else {
                promise.resolve.apply( this, arguments );
            }

            callback.apply( this, arguments );
        });

        return promise.await;
    }
}