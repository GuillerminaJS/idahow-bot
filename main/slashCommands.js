//Cargando las variabls de entorno
require('dotenv').config();

// Importes de plugins y dependencias
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { request } = require('undici');

//const client = new Client({
//        intents: [GatewayIntentBits.Guilds]
//});

//Cargando slash comands y haciendo fetch
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {

  try {

    console.log('Empezados a cargar los (/) commands de la aplicacion.');

    const respuesta = await request('https://idahow-laravel-production.up.railway.app/api/commands');
    const json = await respuesta.body.json();
    const temp = json.map( ({ name, description }) => ({ name, description }) );

    console.log(temp);

    await rest.put(
	Routes.applicationCommands(process.env.CLIENT_ID),
	{ body: temp }
    );

    console.log('Correctamente cargados los (/) commands de la aplicacion.');

  } catch (error) {

    console.error(`An error has ocurred: ${error}`);

  }

})();

//client.login(process.env.TOKEN);
