import { promiseFactory } from '../../helper/helper';

export default class AbstractAdapter {
    constructor({ url = '' }) {
        this.baseUrl = url;
        this.uri = '';

        this.results = {};
        this.resetResults();
    }

    resetResults() {
        return this.results = {
            pendingToCreate: [],
            created: [],
            notCreated: [],

            pendingToRead: [],
            readed: [],
            notReaded: [],

            pendingToUpdate: [],
            updated: [],
            notUpdated: [],

            pendingToDelete: [],
            deleted: [],
            notDeleted: [],

            pendingToPush: [],
            pushed: [],
            notPushed: []
        };
    }
    getResults() {
        return this.results;
    }

    getPromise() {
        return promiseFactory();
    }

    getBaseUrl() {
        return this.baseUrl;
    }
    setBaseUrl( baseUrl ) {
        this.baseUrl = baseUrl;
        return this;
    }

    getUri() {
        return this.uri;
    }
    setUri( uri ) {
        this.uri = uri;
        return this;
    }

    getUrl() {
        return this.baseUrl + this.uri;
    }

    voidAction( name ) {
        throw new Error( name+' adapter\'s method is not defined');
    }

    afterAction( { pendingName, successName, errorName }, { node, id, error } ) {
        if( !error ) {
            this.results[ successName ].push({
                node: node,
                id: id
            });
        }
        else {
            this.results[ errorName ].push({
                node: node,
                id: id
            });
        }

        for( let n in this.results[ pendingName ] ) {
            let { pendingNode } = this.results[ pendingName ][ n ];
            if( pendingNode === node ) {
                this.results[ pendingName ].splice( n, 1 );
                break;
            }
        }

        return !this.results[ pendingName ].length;
    }

    createData( data, checkIfExist ) {
        return this.voidAction( arguments.callee.name );
    }
    afterCreate({ node, id, error }) {
        return this.afterAction(
            { pendingName: 'pendingToCreate', successName: 'created', errorName: 'notCreated' },
            { node, id, error }
        );
    }

    readData( params ) {
        return this.voidAction( arguments.callee.name );
    }
    afterRead({ node, id, error }) {
        return this.afterAction(
            { pendingName: 'pendingToRead', successName: 'readed', errorName: 'notReaded' },
            { node, id, error }
        );
    }

    updateData( data, oldData ) {
        return this.voidAction( arguments.callee.name );
    }
    afterUpdate({ node, id, error }) {
        return this.afterAction(
            { pendingName: 'pendingToUpdate', successName: 'updated', errorName: 'notUpdated' },
            { node, id, error }
        );
    }

    deleteData( params ) {
        return this.voidAction( arguments.callee.name );
    }
    afterDelete({ node, id, error }) {
        return this.afterAction(
            { pendingName: 'pendingToDelete', successName: 'deleted', errorName: 'notDeleted' },
            { node, id, error }
        );
    }

    pushData( data ) {
        return this.voidAction( arguments.callee.name );
    }
    afterPush({ node, id, error }) {
        return this.afterAction(
            { pendingName: 'pendingToPush', successName: 'pushed', errorName: 'notPushed' },
            { node, id, error }
        );
    }

    onChangeData( callback ) {
        return this.voidAction( arguments.callee.name );
    }
}