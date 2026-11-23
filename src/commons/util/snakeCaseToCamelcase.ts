export const snakeCaseToCamelcase = (value: string) => {
  return value
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};
