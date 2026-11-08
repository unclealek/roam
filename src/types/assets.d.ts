declare module "*.jpg" {
  const asset: number;
  export default asset;
}

declare module "*.png" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
