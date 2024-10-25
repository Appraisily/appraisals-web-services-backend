# Dockerfile

# Usa una imagen oficial de Node.js
FROM node:18

# Crear y cambiar al directorio de la app
WORKDIR /usr/src/app

# Copiar los archivos de dependencia
COPY package*.json ./

# Instalar dependencias
RUN npm install --only=production

# Copiar el resto de los archivos de la app
COPY . .

# Exponer el puerto
EXPOSE 8080

# Comando para correr la app
CMD [ "npm", "start" ]
