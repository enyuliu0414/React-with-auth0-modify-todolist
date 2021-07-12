'use strict'

import routes from '../todos-routes';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import axios from 'axios';
import connectToDatabase from '../../../db/db-connect';
import { Todo } from '../../../db/todos-schema';
import dayjs from 'dayjs';
import { get } from 'https';
const createJWKSMock = require('../../../authz/check-jwt')

const assert = require('assert')
const request = require('request-promise-native')
const { getToken } = require('../fixtures')


let mongod, app, server;




const makeAuthdRequest = async (method, uri, body) => {
  const token = getToken()


  const options = {
    baseUrl: `http://localhost:3000`,
    method,
    uri,
    headers: {
      Authorization: `Bearer ${token}`
    },
    resolveWithFullResponse: true,
    json: true,
  }

  if (body) options.body = body

  const response = await request(options)

  return response
}


// jest.setTimeout(100000);

// Some dummy data to test with
const overdueTodo = {
    _id: new mongoose.mongo.ObjectId('000000000000000000000002'),
    title: 'OverdueTitle',
    description: 'OverdueDesc',
    isComplete: false,
    dueDate: dayjs().subtract(1, 'day').format(),
    username: '123'
};

const upcomingTodo = {
    _id: new mongoose.mongo.ObjectId('000000000000000000000003'),
    title: 'UpcomingTitle',
    description: 'UpcomingDesc',
    isComplete: false,
    dueDate: dayjs().add(1, 'day').format(),
    username: '123'
};

const completeTodo = {
    _id: new mongoose.mongo.ObjectId('000000000000000000000004'),
    title: 'CompleteTitle',
    description: 'CompleteDesc',
    isComplete: true,
    dueDate: dayjs().format(),
    username: '123'
}

const undefineTodo = {
    _id: new mongoose.mongo.ObjectId('000000000000000000000005'),
    title: 'CompleteTitle',
    description: 'CompleteDesc',
    isComplete: true,
    dueDate: dayjs().format(),
    username: '321'
}

const dummyTodos = [overdueTodo, upcomingTodo, completeTodo,undefineTodo];

// Start database and server before any tests run
beforeAll(async done => {
    mongod = new MongoMemoryServer();

    await mongod.getUri()
        .then(cs => connectToDatabase(cs));

    app = express();
    app.use(express.json());
    app.use('/api/todos', routes);
    server = app.listen(3000, done);
});

// Populate database with dummy data before each test
beforeEach(async () => {
    await Todo.insertMany(dummyTodos);
});

// Clear database after each test
afterEach(async () => {
    await Todo.deleteMany({});
});

// Stop db and server before we finish
afterAll(done => {
    server.close(async () => {
        await mongoose.disconnect();
        await mongod.stop();
        done();
    });
});


it('retrieves all todos successfully with authentication', async () => {
    const response = await makeAuthdRequest('GET','/api/todos');
    expect(response.statusCode).toBe(200);
    const responseTodos = response.body;
    expect(responseTodos.length).toBe(3);

    for (let i = 0; i < responseTodos.length; i++) {
        const responseTodo = responseTodos[i];
        const expectedTodo = dummyTodos[i];

        expect(responseTodo._id.toString()).toEqual(expectedTodo._id.toString());
        expect(responseTodo.title).toEqual(expectedTodo.title);
        expect(responseTodo.description).toEqual(expectedTodo.description);
        expect(responseTodo.isComplete).toEqual(expectedTodo.isComplete);
        expect(dayjs(responseTodo.dueDate)).toEqual(dayjs(expectedTodo.dueDate));
    }
});

it('retrieves a single todo successfully with authentication', async () => {
    const response = await makeAuthdRequest('GET','/api/todos/000000000000000000000003');
    expect(response.statusCode).toBe(200);

    const responseTodo = response.body;
    expect(responseTodo._id.toString()).toEqual(upcomingTodo._id.toString());
    expect(responseTodo.title).toEqual(upcomingTodo.title);
    expect(responseTodo.description).toEqual(upcomingTodo.description);
    expect(responseTodo.isComplete).toEqual(upcomingTodo.isComplete);
    expect(dayjs(responseTodo.dueDate)).toEqual(dayjs(upcomingTodo.dueDate));
    expect(responseTodo.username).toEqual(upcomingTodo.username);
});

it('returns a 404 when attempting to retrieve a nonexistant todo (valid id) with authentication', async () => {
    try {
        await  makeAuthdRequest('GET','/api/todos/000000000000000000000001');
        fail('Should have thrown an exception.');
    } catch (err) {
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(404);
    }
});

it('returns a 400 when attempting to retrieve a nonexistant todo (invalid id) with authentication', async () => {
    try {
        await makeAuthdRequest('GET','/api/todos/blah');
        fail('Should have thrown an exception.');
    } catch (err) {
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(400);
        expect(response.body).toBe('Invalid ID');
    }
});

it('Creates a new todo with authentication', async () => {

    const newTodo = {
        title: 'NewTodo',
        description: 'NewDesc',
        isComplete: false,
        dueDate: dayjs('2100-01-01').format(),
        username: '123'
    }

    const response = await makeAuthdRequest('POST','/api/todos', newTodo);

    // Check response is as expected
    expect(response.statusCode).toBe(201);
    expect(response.body).toBeDefined();
    const rTodo = response.body;
    expect(rTodo.title).toBe('NewTodo');
    expect(rTodo.description).toBe('NewDesc');
    expect(rTodo.isComplete).toBe(false);
    expect(dayjs(rTodo.dueDate)).toEqual(dayjs('2100-01-01'));
    expect(rTodo.username).toBe('123');
    expect(rTodo._id).toBeDefined();
    expect(response.headers.location).toBe(`/api/todos/${rTodo._id}`);

    // Check that the todo was actually added to the database
    const dbTodo = await Todo.findById(rTodo._id);
    expect(dbTodo.title).toBe('NewTodo');
    expect(dbTodo.description).toBe('NewDesc');
    expect(dbTodo.isComplete).toBe(false);
    expect(dayjs(dbTodo.dueDate)).toEqual(dayjs('2100-01-01'));
    expect(dbTodo.username).toBe('123');

});

it('Gives a 400 when trying to create a todo with no title with authentication', async () => {
    try {

        const newTodo = {
            description: 'NewDesc',
            isComplete: false,
            dueDate: dayjs('2100-01-01').format(),
            username:'123'
        }

        await  makeAuthdRequest('POST','/api/todos', newTodo);
        fail('Should have thrown an exception.');
    } catch (err) {

        // Ensure response is as expected
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(400);

        // Ensure DB wasn't modified
        expect(await Todo.countDocuments()).toBe(4);
    }
})



it('updates a todo successfully with authentication', async () => {

    const toUpdate = {
        _id: new mongoose.mongo.ObjectId('000000000000000000000004'),
        title: 'UPDCompleteTitle',
        description: 'UPDCompleteDesc',
        isComplete: false,
        dueDate: dayjs('2100-01-01').format(),
        username:'123'
    }

    const response = await makeAuthdRequest('PUT','/api/todos/000000000000000000000004', toUpdate);

    // Check response
    expect(response.statusCode).toBe(204);

    // Ensure DB was updated
    const dbTodo = await Todo.findById('000000000000000000000004');
    expect(dbTodo.title).toBe('UPDCompleteTitle');
    expect(dbTodo.description).toBe('UPDCompleteDesc');
    expect(dbTodo.isComplete).toBe(false);
    expect(dayjs(dbTodo.dueDate)).toEqual(dayjs('2100-01-01'));
    expect(dbTodo.username).toBe('123');


})

it('Uses the path ID instead of the body ID when updating with authentication', async () => {

    const toUpdate = {
        _id: new mongoose.mongo.ObjectId('000000000000000000000003'),
        title: 'UPDCompleteTitle',
        description: 'UPDCompleteDesc',
        isComplete: false,
        dueDate: dayjs('2100-01-01').format(),
        username:'123'
    }

    const response = await makeAuthdRequest('PUT','/api/todos/000000000000000000000004', toUpdate);

    // Check response
    expect(response.statusCode).toBe(204);

    // Ensure correct DB entry was updated
    let dbTodo = await Todo.findById('000000000000000000000004');
    expect(dbTodo.title).toBe('UPDCompleteTitle');
    expect(dbTodo.description).toBe('UPDCompleteDesc');
    expect(dbTodo.isComplete).toBe(false);
    expect(dayjs(dbTodo.dueDate)).toEqual(dayjs('2100-01-01'));
    expect(dbTodo.username).toBe('123');

    // Ensure incorrect DB entry was not updated
    dbTodo = await Todo.findById('000000000000000000000003');
    expect(dbTodo.title).toBe('UpcomingTitle');
    expect(dbTodo.description).toBe('UpcomingDesc');
    expect(dbTodo.isComplete).toBe(false);
    expect(dayjs(dbTodo.dueDate)).toEqual(dayjs(upcomingTodo.dueDate));
    expect(dbTodo.username).toBe('123');
})

it('Gives a 404 when updating a nonexistant todo with authentication', async () => {

    try {
        const toUpdate = {
            _id: new mongoose.mongo.ObjectId('000000000000000000000010'),
            title: 'UPDCompleteTitle',
            description: 'UPDCompleteDesc',
            isComplete: false,
            dueDate: dayjs('2100-01-01').format(),
            username:'123'
        }

        await makeAuthdRequest('PUT','/api/todos/000000000000000000000010', toUpdate);
        fail('Should have returned a 404');

    } catch (err) {
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(404);

        // Make sure something wasn't added to the db
        expect(await Todo.countDocuments()).toBe(4);
    }

})

it('Deletes a todo with authentication', async () => {

    const response = await  makeAuthdRequest('DELETE','/api/todos/000000000000000000000003');
    expect(response.statusCode).toBe(204);

    // Check db item was deleted
    expect(await Todo.findById('000000000000000000000003')).toBeNull();

})

it('Doesn\'t delete anything when it shouldn\'t with authentication', async () => {

    const response = await makeAuthdRequest('DELETE','/api/todos/000000000000000000000010');
    expect(response.statusCode).toBe(204);

    // Make sure something wasn't deleted from the db
    expect(await Todo.countDocuments()).toBe(4);

})


it('return 401 when get all todos without authentication', async () => {
   try{
       await axios.get('http://localhost:3000/api/todos');

    }catch(error){
        const { response } = error;
        expect(response).toBeDefined();
        expect(response.status).toBe(401);
        const responseTodos = response.data;
        expect(responseTodos.length).toBeNull;
    }
});
it('returns a 401 when attempting to retrieve a existant todo without authentication', async () => {
    try {
        await axios.get('http://localhost:3000/api/todos/000000000000000000000003');
        fail('Should have thrown an exception.');
    } catch (err) {
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.status).toBe(401);
    }
});




it('Gives a 401 when updating a todo without authentication', async () => {

    try {
        const toUpdate = {
            _id: new mongoose.mongo.ObjectId('000000000000000000000002'),
            title: 'UPDCompleteTitle',
            description: 'UPDCompleteDesc',
            isComplete: false,
            dueDate: dayjs('2100-01-01').format()
        }

        await axios.put('http://localhost:3000/api/todos/000000000000000000000002', toUpdate);
        fail('Should have returned a 404');

    } catch (err) {
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.status).toBe(401);

        // Make sure something wasn't added to the db
        expect(await Todo.countDocuments()).toBe(4);
    }

})
it('Gives a 401 when trying to create a todo without authentication', async () => {
    try {

        const newTodo = {
            title: 'NewTodo',
            description: 'NewDesc',
            isComplete: false,
            dueDate: dayjs('2100-01-01').format()
        }

        await axios.post('http://localhost:3000/api/todos', newTodo);
        fail('Should have thrown an exception.');
    } catch (err) {

        // Ensure response is as expected
        const { response } = err;
        expect(response).toBeDefined();
        expect(response.status).toBe(401);

        // Ensure DB wasn't modified
        expect(await Todo.countDocuments()).toBe(4);
    }
})
it('Deletes a todo without authentication', async () => {
    try{
       await axios.delete('http://localhost:3000/api/todos/000000000000000000000003');
    }catch(error){
        const { response } = error;
        expect(response).toBeDefined();
        expect(response.status).toBe(401);

        // Ensure DB wasn't modified
        expect(await Todo.countDocuments()).toBe(4);
    }

})


it('Test that a401is returned when trying to GET a todo item that doesnt belong to the currentlyauthenticated user.', async () => { 
    try{
        await makeAuthdRequest('GET','/api/todos/000000000000000000000005');
    }catch(error){
        const { response } = error;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(401);
    }
});

it('Test that a 401 is returned when trying to PUT (update) a todo item that does not belong to the currentlyauthenticated user, and that the database is not modified.', async () => { 
    try{
        await makeAuthdRequest('PUT','/api/todos/000000000000000000000005');
    }catch(error){
        const { response } = error;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(401);
    }
});
it('Test that a401is returned when trying to DELETE a todo item that does not belong to the currentlyauthenticated user, and that the database is not modified.', async () => { 
    try{
        await makeAuthdRequest('DELETE','/api/todos/000000000000000000000005');
    }catch(error){
        const { response } = error;
        expect(response).toBeDefined();
        expect(response.statusCode).toBe(401);
    }
});

