module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif)$/,
        use: [
          {
            loader: 'file-loader'
          },
        ],
      },
      {
        test: /\.(svg|eot|ttf|woff2?)$/,
        use: [
          {
            loader: 'ignore-loader'
          },
        ],
      }
    ],
  },
};