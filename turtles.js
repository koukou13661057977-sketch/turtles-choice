// Stylized appearance references: NOAA Fisheries species accounts.
export const TURTLES=Object.freeze({
  leatherback:Object.freeze({id:'leatherback',zh:'棱皮龟',en:'Leatherback',latin:'Dermochelys coriacea',description:Object.freeze({zh:'流线形软甲、七道纵向背脊和长鳍，是远洋游泳者。',en:'A streamlined leathery shell, seven long ridges and sweeping flippers.'}),source:'https://www.fisheries.noaa.gov/species/leatherback-turtle'}),
  green:Object.freeze({id:'green',zh:'绿海龟',en:'Green turtle',latin:'Chelonia mydas',description:Object.freeze({zh:'小而圆的头、光滑椭圆背甲与四对侧盾；成年后主要吃海草和藻类。',en:'A small rounded head, smooth oval shell and four pairs of side scutes. Adults mainly eat seagrass and algae.'}),source:'https://www.fisheries.noaa.gov/species/green-turtle'}),
  hawksbill:Object.freeze({id:'hawksbill',zh:'玳瑁',en:'Hawksbill',latin:'Eretmochelys imbricata',description:Object.freeze({zh:'细长钩喙、琥珀色叠瓦盾片和锯齿状后缘；主要以海绵为食。',en:'A narrow hooked beak, overlapping amber scutes and a serrated rear edge. Mainly a sponge eater.'}),source:'https://www.fisheries.noaa.gov/species/hawksbill-turtle'}),
  loggerhead:Object.freeze({id:'loggerhead',zh:'赤蠵龟',en:'Loggerhead',latin:'Caretta caretta',description:Object.freeze({zh:'宽大的头、结实的下颌和红棕色心形背甲，擅长吃硬壳猎物。',en:'A broad head, strong jaws and a reddish heart-shaped shell, adapted to hard-shelled prey.'}),source:'https://www.fisheries.noaa.gov/species/loggerhead-turtle'})
});
export const TURTLE_IDS=Object.freeze(Object.keys(TURTLES));
export const turtleConfig=id=>TURTLES[id]??TURTLES.leatherback;
export const TURTLE_GAME_NOTE=Object.freeze({zh:'本游戏统一以水母计分，各海龟的速度与判定相同；现实食谱因物种而异。',en:'All turtles share jellyfish scoring, speed and collision rules here. Real diets differ by species.'});
