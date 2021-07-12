import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth0 } from "@auth0/auth0-react";

/**
 * A more advanced version of useGet(), which exposes functions for creating, updating, and deleting
 * items, and being able to have these modifications applied to the "data" state without having to do
 * a re-fetch.
 */
export default function useCrud(baseUrl, initialState = null, idProp = '_id') {
    const [data, setData] = useState(initialState);
    const [isLoading, setLoading] = useState(false);
    const [version, setVersion] = useState(0);
    const { getAccessTokenSilently } = useAuth0();

    // Load all data when we first use this hook, or whenever we change the url or re-fetch.
    useEffect(async() => {
        const token = await getAccessTokenSilently()
        setLoading(true);
        axios.get(baseUrl,{
            headers:{
                Authorization: `Bearer ${token}`,
            }
        })
            .then(response => {
                setLoading(false);
                setData(response.data);
            })
            .catch(err => {
                // TODO error handling...
                setLoading(false);
            });
    }, [baseUrl, version]);

    // Trigger a re-fetch
    function reFetch() {
        setVersion(version + 1);
    }

    /**
     * Update the given item. If successful, update the corresponding item
     * in the "data" state above.
     * 
     * Alternatively we could pre-emptively update the "data" state to re-render
     * with the new data, then roll it back if the server-side update fails.
     */
    const update = async(item) => {
        try{
        const token = await getAccessTokenSilently();
        return axios.put(`${baseUrl}/${item[idProp]}`, item,{
            headers:{
                Authorization: `Bearer ${token}`,
             }
        })
            .then(response => {
                setData(data.map(d =>
                    d[idProp] === item[idProp] ? { ...d, ...item } : d));
            })
            .catch(err => {
                // TODO error handling
            });
        }catch(error){
            console.error(error);
            console.log("login to update!");
        }
    }

    /**
     * Add the given item. If successful, add the corresponding item
     * in the "data" state above.
     * 
     * Alternatively we could pre-emptively update the "data" state to re-render
     * with the new data, then roll it back if the server-side update fails.
     */
    const create = async(item)=> {
        try{
        const token = await getAccessTokenSilently();
        return axios.post(baseUrl, item,{
            headers:{
                Authorization: `Bearer ${token}`,
             }
        })
            .then(response => {
                const newItem = response.data;
                setData([...data, newItem]);
            })
            .catch(err => {
                // TODO error handling
            });
        }catch(error){
            console.error(error);
            console.log("login to create!");
        }
    }

    /**
     * Remove the item with the given id from the server. If successful, also remove the given
     * item from the "data" state.
     */
    const deleteItem = async(id) => {
        try{
           const token = await getAccessTokenSilently();
           return axios.delete(`${baseUrl}/${id}`,{
               headers:{
                  Authorization: `Bearer ${token}`,
               }
           })
           .then(response => {
               setData(data.filter(item => item[idProp] !== id));
            })
           .catch(err => {
            // TODO error handling
               console.error(err);
               console.log("Token request failed!");
           });
        }catch(error){
           console.error(error);
           console.log("login to delete!");
        }
    }

    return { data, isLoading, reFetch, update, create, deleteItem };
}