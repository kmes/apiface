export default class EntityContainer {
    constructor({ entityFactory }) {
        if( !entityFactory || typeof entityFactory.make !== 'function' ) {
            throw new Error('entityFactory params don\'t implements EntityFactory interface');
        }
        this.entityFactory = entityFactory;

        this.entities = {};
    }

    setEntity({ uri, name, fixedParams, entityClass }) {
        var entity = this.entityFactory.make({
            uri: uri,
            name: name,
            fixedParams: fixedParams,
            entityClass: entityClass
        });

        if( !entity || !entity.name ) {
            throw new Error('entityFactory.make don\'t return a valid implementation of BaseEntity interface');
            //return null;
        }

        return this.entities[ entity.name ] = entity;
    }

    getEntityByName( name ) {
        if( !name || typeof name !== 'string' ) return false;

        return this.entities[ name ] || null;
    }

    getEntityByUri( uri ) {
        if( !uri || typeof uri !== 'string' ) return false;

        for( let entity of this.entities ) {
            if( entity.getUri() == uri ) return entity;
        }

        return null;
    }


}