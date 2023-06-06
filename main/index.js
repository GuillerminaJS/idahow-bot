// Cargando las variables de entorno.
require('dotenv').config();
//----------

// IMportacion de plugins y dependencias.
const { Client, Events, Message, IntentsBitField, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, MessageEmbed, EmbedBuilder, Embed } = require('discord.js');
const mongoose = require('mongoose');
const Level = require('./Level.js');
const calcXp = require('./calcXp.js');
const { request } = require('undici');
//----------

// Creando una nueva instancia del cliente
const client = new Client({
 intents: [
  IntentsBitField.Flags.Guilds,
  IntentsBitField.Flags.GuildMembers,
  IntentsBitField.Flags.GuildMessages,
  IntentsBitField.Flags.MessageContent,
 ],
});
//----------

// Conenctandonos a la DB de mongoDB
(async () => {
 try {
  mongoose.set('strictQuery', false);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a la DB de cloud');
 } catch (error) {
  console.log(`Ha ocurrido un error: ${error}`);
 }
})();
//----------

// Mensaje de login del cliente
client.on(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}.`);
});

// -- Comienzo de comandos --

// Interacciones activas

//Tarjeta de bienvenida
client.on('guildMemberAdd', member => {
   const channel = member.guild.channels.cache.find(ch => ch.name.includes('bienvenida'));
   const embed = new EmbedBuilder()
	.setColor('#a437db')
	.setTitle(`Bienvenido/a a ${member.guild.name}!`)
	.setImage(member.user.avatarURL())
	.setDescription(`Hola ${member.displayName}! esperamos que tengas una agradable estancia.`);
   channel.send({ embeds: [embed] });
});
//-----

// lvl up
function getRandomXp(min, max){
 min = Math.ceil(min);
 max = Math.floor(max);

 return Math.floor(Math.random() * (max - min + 1)) + min;
}

client.on('messageCreate', async (msg) => {
 if (!msg.inGuild() || msg.author.bot) return;

 const xpToGive = getRandomXp(5, 15);

 const query = {
  userId: msg.author.id,
  guildId: msg.guild.id,
 };

 try {
  const level = await Level.findOne(query);

  if (level) {
   level.xp += xpToGive;

   if (level.xp > calcXp(level.level)) {
    level.xp = 0;
    level.level += 1;

    msg.channel.send(`Enhorabuena ${msg.member}! has alcanzado el nivel ${level.level}.`);
   }
   await level.save().catch((e) =>{
    console.log(`Error saving update ${e}`);
    return;
   });
  }

  // Si el usuario no tiene nivel
  else {
   // Se crea nivel nuevo
   const newLevel = new Level({
    userId: msg.author.id,
    userName: msg.author.username,
    guildId: msg.guild.id,
    xp: xpToGive,
   });

   await newLevel.save();
  }

 } catch (error) {
  console.log(`Error with xp: ${error}`);
 }
});
//-----

// Interacciones pasivas

// Interaction commands
client.on(Events.InteractionCreate, async (interaction) => {

    if ( !interaction.isButton() && !interaction.isChatInputCommand() ) return;

    const { commandName } = interaction;

    // ...
    if (interaction.commandName === 'profile') {

	const targetUserId = interaction.member.id;
	const targetUserObj = await interaction.guild.members.fetch(targetUserId);

	const fetchedLevel = await Level.findOne({
		userId: targetUserId,
		guildId: interaction.guild.id,
	});

	if (fetchedLevel.level === 0) {
	 interaction.reply('Aun no tienes un perfil.');
	 return;
        } else {
	 const embed = new EmbedBuilder()
		.setColor('#a437db')
		.setTitle(`Perfil de ${targetUserObj.user.username}`)
		.setThumbnail(targetUserObj.user.displayAvatarURL({ dynamic: true }))
		.setDescription(`Nivel: ${fetchedLevel.level} | xp: ${fetchedLevel.xp}`);
		await interaction.reply({ embeds: [embed] });
		return;
	}
    }
    if (interaction.commandName === 'leaderboard') {
	if (!interaction.inGuild()) return;
	const fetchedLevel = await Level.find({
                        guildId: interaction.guild.id
               }).sort({ level: -1, xp: -1 });
	const fields = [];
	for (let i = 0; i < fetchedLevel.length; i++) {
                const usuario = fetchedLevel[i];
                fields.push({ name:`#${i + 1} | ${usuario.userName}`, value:` Nivel:${usuario.level} - Experiencia: ${usuario.xp}`});
        }
	const embed = new EmbedBuilder()
		.setColor('#a437db')
		.setThumbnail(interaction.guild.iconURL({ dynamic: true }))
		.setTitle(`Leader Board del servidor ${interaction.guild.name}`)
		.setDescription('Lista de usuarios')
		.addFields(fields)
		.setTimestamp();
	await interaction.reply({ embeds: [embed] });
    }
     if (interaction.commandName === 'weather') {

	await interaction.deferReply();
        const apiKey = process.env.WEATHER_API_KEY;

        interaction.editReply('De que lugar quieres ver el tiempo? ( indica con: ciudad,pais ) .');

        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async (msg) => {
            const location = msg.content.trim();

            const weatherData = await request(`http://api.openweathermap.org/data/2.5/weather?q=${location}&APPID=${apiKey}&units=metric`)
            .then(respuesta => respuesta.body.json());

            if (weatherData.message === "city not found") {
                await interaction.followUp('No se ha podido encontrar la localizacion indicada');
                return;
            }

	    const localizacion = weatherData.name;
	    const humedad = weatherData.main.humidity;
            const temperatura = weatherData.main.temp;
            const tempMax = weatherData.main.temp_max;
            const tempMin = weatherData.main.temp_min;
            const clima = weatherData.weather[0].description;

	    const embed = new EmbedBuilder()
		.setColor('#a437db')
		.setTitle(`El tiempo de: ${localizacion} `)
		.addFields(
		  { name: 'Temperatura actual: |', value: `${temperatura}ºC`, inline: true },
		  { name: 'Maxima:', value:`${tempMax}ºC -`, inline: true },
		  { name: 'Minima:', value:`${tempMin}ºC`, inline: true },
		  { name: 'Humedad:', value:`${humedad}`},
		  { name: 'Clima:', value:`${clima}`},
		)
		.setTimestamp();

	    await interaction.followUp({ embeds: [embed] })

        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.followUp('No se ha proporcionado ninguna localizacion.');
            }
        })
    }
    if (interaction.commandName === 'autorole') {

     if (!interaction.member.permissions.has('Administrator')) {
	interaction.reply({content: 'No dispones de los permisos necesarios para realizar este comando', ephemeral: true})
	return;
     }

     const roles = [
      {
       label: 'usuario'
      },
      {
       label: 'tester'
      },
     ];

     const row = new ActionRowBuilder();

     roles.forEach((role) => {
      row.components.push(
       new ButtonBuilder().setCustomId(role.label).setLabel(role.label).setStyle(ButtonStyle.Primary)
      )
     });

     await interaction.reply({content: 'Asigna o elimina los roles que se muestran abajo.', components: [row] });

    }

    if (interaction.isButton()) {

	const user = client.users.cache.get(interaction.member.user.id);
	const role = interaction.guild.roles.cache.find((r) => r.name === interaction.customId);

	await interaction.deferReply({ ephemeral: true})
	if (!role) {
	 interaction.editReply({content: "No se ha podido encontrar el rol seleccionado"})
	 return;
	}

	const hasRole = interaction.member.roles.cache.has(role.id);

	if (!hasRole) {
	 await interaction.member.roles.add(role);
	 await interaction.editReply({content: `asignado rol : ${role}`});
	 return;
	} else {
	 await interaction.member.roles.remove(role);
	 await interaction.editReply({content: `quitado rol : ${role}`});
	 return;
	}
    }
});
//----------

//Procesando el token del bot
client.login(process.env.TOKEN);
