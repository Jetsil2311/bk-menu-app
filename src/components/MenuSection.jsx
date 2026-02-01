import {MenuCard} from "./MenuCard.jsx";
import {SectionBanner} from "./SectionBanner.jsx";
import {products} from "../assets/products.js";

export const MenuSection = ({children, desc, onAddToCart}) => {
    return (
        <div>
            <SectionBanner desc={desc}>{children}</SectionBanner>
            <ul className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-visible">
                    {
                        products.map((product) => {
                            if (product.section === children) {
                                return (
                                    <MenuCard
                                        key={product.id}
                                        name={product.name}
                                        desc={product.desc}
                                        price={product.price}
                                        img={product.img}
                                        long_desc={product.long_desc}
                                        flavors={product.flavors ? product.flavors : null}
                                        image={product.image}
                                        id={product.id}
                                        onAddToCart={onAddToCart}
                                    />
                                );
                            }
                        })
                    }
                </div>
            </ul>
        </div>
    )
}
