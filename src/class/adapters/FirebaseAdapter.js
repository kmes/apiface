import AbstractAdapter from './abstract/AbstractAdapter';

import Firebase from 'firebase';

export default class FirebaseAdapter extends AbstractAdapter {
    constructor({ url = '' }) {
        super({ url });

        this.fb = new Firebase( this.getUrl() );
    }

    getUriRef( uri = this.getUri() ) {
        return this.fb.child( uri );
    }

    createData( data, checkIfExist = false ) {
        var promise = this.getPromise();

        var uriRef = this.getUriRef();

        if( checkIfExist ) {
            uriRef.transaction( function( currentData ) {
                if( !currentData || currentData === {} || currentData === [] ) {
                    promise.reject({ currentData });
                }
                else {
                    return data;
                }
            })
                .then( ( response ) => promise.resolve({ data: data, response: response || data }) )
                .catch( ( error ) => promise.reject({ response: error }) );
        }
        else {
            uriRef.set( data )
                .then( ( response ) => promise.resolve({ data: data, response: response || data }) )
                .catch( ( error ) => promise.reject({ response: error }) );
        }

        return promise.await;
    }
    readData( params ) {
        var promise = this.getPromise();

        var uriRef = this.getUriRef();
        uriRef.once('value',
            ( snap ) => promise.resolve({ data: snap.val(), response: snap }),
            ( error ) => promise.reject({ response: error })
        );

        return promise.await;
    }
    updateData( data, oldData = null ) {
        var promise = this.getPromise();

        var uriRef = this.getUriRef();

        if( oldData ) {
            uriRef.transaction( function( currentData ) {
                if( JSON.stringify( currentData ) != JSON.stringify( oldData ) ) {
                    promise.reject({ currentData });
                }
                else {
                    return data;
                }
            })
                .then( ( response ) => promise.resolve({ data: data, response: response || data }) )
                .catch( ( error ) => promise.reject({ response: error }) );
        }
        else  {
            uriRef.update( data )
                .then( ( response ) => promise.resolve({ data: data, response: response || data }) )
                .catch( ( error ) => promise.reject({ response: error }) );
        }

        return promise.await;
    }
    deleteData( params ) {
        var promise = this.getPromise();

        var uriRef = this.getUriRef();
        uriRef.remove()
            .then( () => promise.resolve({ data: params, response: params }) )
            .catch( ( error ) => promise.reject({ response: error }) );

        return promise.await;
    }

    pushData( data ) {
        var promise = this.getPromise();

        var uriRef = this.getUriRef();

        var _fnPushed = function({ node, id, error }) {
            this.afterPush({ node, id, error });

            if( !this.results.pendingToPush.length ) {

                if( !this.results.notPushed.length ) {
                    promise.resolve({ data: data, response: this.results });
                }
                else {
                    promise.reject({ response: this.results });
                }

            }
        }.bind(this);

        var nodes = data && typeof data.length !== 'undefined' ? data : [ data ];
        for( let node of nodes ) {
            let nodeRef = uriRef.push( node );
            nodeRef
                .then( () => _fnPushed({ node: node, id: nodeRef.key() }) )
                .catch( ( error ) => _fnPushed({ node: node, id: nodeRef.key(), error: error || true }) );
        }

        return promise.await;
    }

    onChangeData( callback = () => {} ) {
        var promise = this.getPromise();

        var uriRef = this.getUriRef();
        uriRef.once('value',
            ( snap ) => {
                var oldSnap = snap;

                uriRef.on('value',
                    ( newSnap ) => {
                        callback(
                            { data: newSnap.val(), response: newSnap },
                            { data: oldSnap.val(), response: oldSnap }
                        );
                        promise.resolve(
                            { data: newSnap.val(), response: newSnap },
                            { data: oldSnap.val(), response: oldSnap }
                        );

                        oldSnap = newSnap;
                    },
                    ( error ) => {
                        promise.reject({ response: error });
                    }
                );

            },
            ( error ) => {
                promise.reject({ response: error });
            }
        );

        return promise.await;

    }

}