// 精灵模型注册表：species key → 体素构建函数
import bulbasaur from './bulbasaur.js';
import ivysaur from './ivysaur.js';
import venusaur from './venusaur.js';
import charmander from './charmander.js';
import charmeleon from './charmeleon.js';
import charizard from './charizard.js';
import squirtle from './squirtle.js';
import wartortle from './wartortle.js';
import blastoise from './blastoise.js';
import caterpie from './caterpie.js';
import metapod from './metapod.js';
import butterfree from './butterfree.js';
import weedle from './weedle.js';
import kakuna from './kakuna.js';
import beedrill from './beedrill.js';
import pidgey from './pidgey.js';
import pidgeotto from './pidgeotto.js';
import pidgeot from './pidgeot.js';
import rattata from './rattata.js';
import raticate from './raticate.js';
import pikachu from './pikachu.js';
import raichu from './raichu.js';
import clefairy from './clefairy.js';
import clefable from './clefable.js';
import vulpix_a from './vulpix_a.js';
import ninetales_a from './ninetales_a.js';
import psyduck from './psyduck.js';
import golduck from './golduck.js';
import growlithe from './growlithe.js';
import arcanine from './arcanine.js';
import oddish from './oddish.js';
import gloom from './gloom.js';
import vileplume from './vileplume.js';
import geodude from './geodude.js';
import graveler from './graveler.js';
import golem from './golem.js';
import magmar from './magmar.js';
import magikarp from './magikarp.js';
import gyarados from './gyarados.js';
import seel from './seel.js';
import dewgong from './dewgong.js';
import gastly from './gastly.js';
import haunter from './haunter.js';
import gengar from './gengar.js';
import onix from './onix.js';
import eevee from './eevee.js';
import vaporeon from './vaporeon.js';
import jolteon from './jolteon.js';
import flareon from './flareon.js';
import snorlax from './snorlax.js';
import tentacool from './tentacool.js';
import tentacruel from './tentacruel.js';

export const MODELS = {
  bulbasaur, ivysaur, venusaur, charmander, charmeleon, charizard,
  squirtle, wartortle, blastoise, caterpie, metapod, butterfree,
  weedle, kakuna, beedrill, pidgey, pidgeotto, pidgeot,
  rattata, raticate, pikachu, raichu, clefairy, clefable,
  vulpix_a, ninetales_a, psyduck, golduck, growlithe, arcanine,
  oddish, gloom, vileplume, geodude, graveler, golem,
  magmar, magikarp, gyarados, seel, dewgong, gastly, haunter, gengar,
  onix, eevee, vaporeon, jolteon, flareon, snorlax, tentacool, tentacruel,
};

export function getModel(key) {
  const m = MODELS[key];
  if (!m) throw new Error('缺少模型: ' + key);
  return m;
}
