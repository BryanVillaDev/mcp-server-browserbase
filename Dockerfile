# Imagen base con soporte para Node 18
FROM node:18

# Crear y usar directorio de trabajo
WORKDIR /app

# Copiar los archivos del proyecto
COPY . .

# Instalar dependencias
RUN npm install

# Exponer el puerto en el que corre Express
EXPOSE 3000

# Comando para iniciar el servidor
CMD ["npm", "start"]
