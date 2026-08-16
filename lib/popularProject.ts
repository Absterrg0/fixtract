export type PopularProject = {
  _id: string;
  title: string;
  category: string;
  service: string;
  image: string | null;
  location: string | null;
  startingPrice: number | null;
  priceType: string;
  avgRating: number;
  totalReviews: number;
  professional: {
    name: string;
    profileImage: string | null;
    city: string | null;
    country: string | null;
  } | null;
};
