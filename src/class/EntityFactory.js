import BaseEntity from './entities/BaseEntity'

export default class EntityFactory {
    constructor() {

    }

    make({ uri = '', name = null, fixedParams = {}, entityClass = BaseEntity }) {

        if( !uri && !name ) return null;

        return new entityClass({
            name: name || uri,
            uri: uri,
            fixedParams: fixedParams
        });

    }
}