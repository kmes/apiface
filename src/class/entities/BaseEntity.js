import { DATA_STATUS } from  '../config/constants.js';

export default class BaseEntity {
    constructor({ uri, name, fixedParams = {} }) {
        this.uri = uri;
        this.name = name;
        this.fixedParams = fixedParams;
        this.actionParams = {};
        this.params = Object.assign( {}, this.fixedParams, this.actionParams );

        this.status = DATA_STATUS.pending; //1: pending to fetch, 2: modified, 3: synched

        this.data = null;

        this.createAt = new Date();
        this.updateAt = null;
    }

    getCreateAt() {
        return this.createAt;
    }
    getUpdateAt() {
        return this.updateAt;
    }
    refreshUpdateAt() {
        return this.updateAt = new Date();
    }

    getName() {
        return this.name;
    }

    getUri() {
        return this.uri;
    }
    setUri( uri = '' ) {
        if( !uri || typeof uri !== 'string' ) return this.uri;
        return this.uri = uri;
    }

    getFixedParams() {
        return this.fixedParams;
    }
    setFixedParams( params = null ) {
        if( typeof params !== 'object' || typeof params.length !== 'undefined' ) {
            return this.fixedParams;
        }

        this.fixedParams = params;
        this.mergeParams();

        return this.fixedParams;
    }
    getActionParams() {
        return this.actionParams;
    }
    setActionParams( actionParams = {} ) {
        this.actionParams = actionParams;
        this.mergeParams();

        return this.actionParams;
    }
    getParams() {
        return this.params;
    }
    mergeParams() {
        return this.params = { ...this.getFixedParams(), ...this.getActionParams() };
    }

    getStatus() {
        return this.status;
    }
    setStatus( status ) {
        this.status = status;
    }

    getData() {
        return this.data;
    }

    setData( data = {} ) {
        this.data = data;
        this.setStatus( DATA_STATUS.modified );
        this.refreshUpdateAt();

        return this.getData();
    }

    pushData( data ) {
        if( !data ) return false;
        if( typeof this.data !== 'object' || typeof this.data.push !== 'function' ) {
            return false;
        }

        this.data.push( data );

        this.setStatus( DATA_STATUS.added );
        this.refreshUpdateAt();
    }

    get( field ) {
        let data = this.getData();
        return typeof data === 'object' ? data[ field ] : false;
    }
    set( field, value ) {
        let data = this.getData();
        if( typeof data !== 'object' ) return false;
        data[ field ] = value;

        return this.setData( data );
    }

}