// Stylized appearance references: NOAA Fisheries species accounts.
export const TURTLES=Object.freeze({
  leatherback:Object.freeze({id:'leatherback',zh:'棱皮龟','zh-Hant':'棱皮龜',en:'Leatherback',latin:'Dermochelys coriacea',description:Object.freeze({zh:'流线形软甲、七道纵向背脊和长鳍，是远洋游泳者。','zh-Hant':'流線形軟甲上有七道縱脊，長鰭肢適合遠洋游動。',en:'A streamlined leathery shell, seven long ridges and sweeping flippers.'}),source:'https://www.fisheries.noaa.gov/species/leatherback-turtle'}),
  green:Object.freeze({id:'green',zh:'绿海龟','zh-Hant':'綠海龜',en:'Green turtle',latin:'Chelonia mydas',description:Object.freeze({zh:'小而圆的头、光滑椭圆背甲与四对侧盾；成年后主要吃海草和藻类。','zh-Hant':'頭小而圓，橢圓背甲光滑，兩側有四對盾片。成年後主要吃海草和藻類。',en:'A small rounded head, smooth oval shell and four pairs of side scutes. Adults mainly eat seagrass and algae.'}),source:'https://www.fisheries.noaa.gov/species/green-turtle'}),
  hawksbill:Object.freeze({id:'hawksbill',zh:'玳瑁','zh-Hant':'玳瑁',en:'Hawksbill',latin:'Eretmochelys imbricata',description:Object.freeze({zh:'细长钩喙、琥珀色叠瓦盾片和锯齿状后缘；主要以海绵为食。','zh-Hant':'細長的鈎喙，配上像屋瓦般重疊的琥珀色盾片，背甲後緣有鋸齒。主要吃海綿。',en:'A narrow hooked beak, overlapping amber scutes and a serrated rear edge. Mainly a sponge eater.'}),source:'https://www.fisheries.noaa.gov/species/hawksbill-turtle'}),
  loggerhead:Object.freeze({id:'loggerhead',zh:'赤蠵龟','zh-Hant':'赤蠵龜',en:'Loggerhead',latin:'Caretta caretta',description:Object.freeze({zh:'宽大的头、结实的下颌和红棕色心形背甲，擅长吃硬壳猎物。','zh-Hant':'頭部寬大，背甲呈紅棕色心形。結實的顎部能咬碎硬殼。',en:'A broad head, strong jaws and a reddish heart-shaped shell, adapted to hard-shelled prey.'}),source:'https://www.fisheries.noaa.gov/species/loggerhead-turtle'})
});
export const TURTLE_IDS=Object.freeze(Object.keys(TURTLES));
export const turtleConfig=id=>TURTLES[id]??TURTLES.leatherback;
export const TURTLE_GAME_NOTE=Object.freeze({zh:'本游戏统一以水母计分，各海龟的速度与判定相同；现实食谱因物种而异。','zh-Hant':'各款海龜的速度和計分相同，都以水母為食。不同海龜在自然環境下吃的食物各有不同。',en:'All turtles share jellyfish scoring, speed and collision rules here. Real diets differ by species.'});
