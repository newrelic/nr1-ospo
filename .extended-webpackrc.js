module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff2?)$/,
        use: [
          {
            loader: 'file-loader',
            options: {

            },
          },
        ],
      }
    ],
  },
};