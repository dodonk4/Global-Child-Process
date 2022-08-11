import express from 'express';

import http from 'http';

import { Server } from 'socket.io';

import session from 'express-session';

import Contenedor from './public/productos.js'

import Mensajeria from './public/mensajes.js'

import MongoStore from 'connect-mongo';

import bodyParser from 'body-parser';

import { engine } from 'express-handlebars';

import passport from 'passport';

import { Strategy } from 'passport-local'

import flash from 'connect-flash';

import routerUsuariosRegistrados from './routers/usuariosRegistradosRouter.js';

import routerRandom from './routers/routerRandom.js';

import { usuariosDao } from './daos/index.js';

import dotenv from 'dotenv';

import util from 'util';

import { fork } from 'child_process';

import path from 'path';

import {fileURLToPath} from 'url';

import {puerto} from './minimist/minimist.js'


dotenv.config({
    path: './.env'
      
  })

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const puerto = process.env.PORT || 8080;
const numeroDeCalculo = process.env.RANDOM;

const caja = new Contenedor();
const mensajeriaANormalizar = new Mensajeria('./public/mensajesANormalizar.txt');

const advancedOptions = { useNewUrlParser: true, useUnifiedTopology: true }
const app = express()

app.engine('handlebars', engine({defaultLayout: "index"}));
app.set('view engine', 'handlebars');
app.set("views", "./public/views");
app.use(express.json())
app.use(express.static('public'))
app.use(express.urlencoded())
app.use(bodyParser.urlencoded());
app.use(flash());
app.use(routerUsuariosRegistrados);
app.use(routerRandom);
const httpServer = new http.Server(app);
const io = new Server(httpServer);


passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use('login', new Strategy({ 
    usernameField: 'nombre',
    passwordField: 'contraseña',
},
    async (username, password, done) => {
        let usuarioEncontrado = 0;
        const obj = await usuariosDao.getAll();
        console.log(username);
        console.log(password);
        for (let index = 0; index < obj.length; index++) {
            const usuario = await obj[index];
            console.log(usuario.nombre);
            console.log(usuario.contraseña);
            if(await usuario.nombre == username){
                usuarioEncontrado++;
                if(await usuario.contraseña == password){
                    usuarioEncontrado++;
                }
            }
            console.log(usuarioEncontrado);
        }
        if(usuarioEncontrado == 2){
            done(null, { id: 1, nombre: username, contraseña: password})
        }else{
            done(null, false)
        }
    }))


app.use(session({
    store: MongoStore.create({
        mongoUrl: `mongodb+srv://root:1234@cluster0.5xw3itz.mongodb.net/?retryWrites=true&w=majority`,
        mongoOptions: advancedOptions
    }),
    secret: '123456789',
    resave: true,
    saveUninitialized: true
}))


app.use(passport.initialize());
app.use(passport.session());

app.get('/registro', (req, res)=>{
    res.render('inicio');
})

app.post('/login', async (req,res)=>{
     if(req.body.nombre){
        res.render('registrado', {nombre: req.body.nombre} ); 
        await usuariosDao.save(req.body);
      }
      else{
        res.send('login failed')
      }
})


app.get('/login',(req,res)=>{
    res.render('registrado');
})

app.get('/inicio', async (req, res)=>{
    console.log(await caja.obtenerTodos());
    if (req.session.passport) {
        await caja.crearTabla();
        await caja.obtenerTodos();
        let productos = await caja.obtenerTodos();
        let mensajes = await mensajeriaANormalizar.obtenerTodos();
        res.render('logueado', { titulo: 'PRODUCTO', titulo2: 'PRECIO', titulo3: 'THUMBNAIL', productos, mensajes, nombre: req.session.passport.user.nombre});
    } else {
        res.render('redireccion');
    }
    
    })

app.post('/inicio', passport.authenticate('login', { failureRedirect: '/fail-login', failureFlash: true}), async (req, res)=>{
    req.session.user = req.body.nombre;
    req.session.password = req.body.contraseña;
    req.session.cookie.maxAge = 60000;
    await caja.obtenerTodos();
    let productos = await caja.obtenerTodos();
    let mensajes = await mensajeriaANormalizar.obtenerTodos();
    res.render('logueado', { titulo: 'PRODUCTO', titulo2: 'PRECIO', titulo3: 'THUMBNAIL', productos, mensajes, nombre: req.session.passport.user.nombre});

})

app.get('/fail-registro', (req, res)=>{
    console.log(req.flash('error'));
    res.redirect('/');
})

app.get('/fail-login', (req, res)=>{
    console.log(req.flash('error'));
    res.send('Fallaste el login')
})


app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        res.json({ status: 'Logout ERROR', body: err })
      } else {
        res.render('logout')
      }
    })
  })

app.get('/info', (req, res)=>{
    function print(objeto) {
        return util.inspect(objeto, true, 0, false);
      }
    let cosa = Object.entries(process.memoryUsage());
    let cosa2 = JSON.stringify(cosa[0]);
    let newCosa = cosa2.replace('"rss",', '').replace('[', '').replace(']', '');
    res.send(`Path de ejecución: ${path.join(__dirname, '/server.js')}<br>
    Carpeta del proyecto: ${process.cwd()}<br>
    Process ID: ${process.pid}<br>
    Version de Node.js: ${process.version}<br>
    Título del proceso: ${process.title}<br>
    Sistema operativo: ${process.platform}<br>
    Memoria reservada: ${newCosa}<br>
    Argumentos de Entrada: ${process.argv.slice(2)}`);
    
})



const server = app.listen(puerto, () => {
    console.log(`escuchando en puerto ${puerto}`)
})