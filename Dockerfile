# Imagen base con soporte para ES Modules
FROM node:20

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Copiar dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto (usa el mismo que en tu index.js)
EXPOSE 3000

# Comando por defecto
CMD [ "npm", "start" ]
